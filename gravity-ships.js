class Vec {
    constructor(x, y) {
      this.x = x;
      this.y = y;
    }
    static randomVector (xMin, xMax, yMin, yMax) {
      return new Vec(Math.random()*(xMax-xMin) + xMin, Math.random()*(yMax-yMin) + yMin)
    }
    static fromPolar (rho, theta) {
      return new Vec (rho * Math.cos(theta), rho * Math.sin(theta));
    } 
    static randomPolarVector (origin, rhoMin, rhoMax, thetaMin, thetaMax) {
      let vector = Vec.fromPolar(Math.random()*(rhoMax-rhoMin) + rhoMin, 
                                 Math.random()*(thetaMax-thetaMin) + thetaMin);
      return vector.plus(origin);
    }    
    plus (other) {
      return new Vec(this.x + other.x, this.y + other.y);
    }
    minus (other) {
      return new Vec(this.x - other.x, this.y - other.y);
    }
    times(factor) {
      return new Vec(this.x * factor, this.y * factor);
    }
    get magnitude () {
      return Math.sqrt(this.x*this.x + this.y*this.y);
    }
    get versor () {
      return new Vec(this.x, this.y).times(1.0/this.magnitude);
    }
    distance(other) {
      return this.minus(other).magnitude;
    }
  }

const gravityMassConstant = 100; // G*M, in physical terms

class Mobile {
  constructor (pos, vel) {
    this.pos = pos ?? Vec.randomPolarVector(center, 2*solRadius, window.innerWidth/2, 0, Math.PI);
    this.vel = vel ?? new Vec(0, 0); // Vec.randomVector(-1, 1, -1, 1);
    this.accel;
  }
  acceleration () {
    let vectorToSun = center.minus(this.pos);
    // if distance < solRadius/2, use that (¿Why? Because it painted me. :P)
    this.accel = vectorToSun.times( gravityMassConstant / 
                                    Math.pow (Math.max(vectorToSun.magnitude, solRadius/2), 3) );
  }
  updatePosition (deltaT) {
    let newPos = this.pos.plus(this.vel.times(.1*deltaT));
    newPos.x = newPos.x < 0 ? window.innerWidth : newPos.x > window.innerWidth ? 0 : newPos.x;
    newPos.y = newPos.y < 0 ? window.innerHeight : newPos.y > window.innerHeight ? 0 : newPos.y;
    this.pos = newPos;
  }
  updateVelocity (deltaT) {
    this.vel = this.vel.plus(this.accel.times(.1*deltaT));
  }
  move (deltaT) {
    this.acceleration();
    this.updateVelocity(deltaT);
    this.updatePosition(deltaT);
  }
  tooCloseToSun () {
    return this.pos.distance(center) <= solRadius + this.radius;
  }
  tooCloseTo (other) {
    return this.pos.distance(other.pos) <= this.radius + other.radius;
  }
}

// let colors = ['#FFBF00', '#40E0D0', '#DFFF00', '#6495ED', '#DE3163', '#CCCCFF'];
let colors = ['#FF756D', '#5DB1D1', '#FFF49C', '#B88BAD', '#90C978', '#FFFFFF'];
let KeysOfPlayers = [["ArrowUp", "ArrowLeft", "ArrowDown", "ArrowRight"],
                     ["w", "a", "s", "d"], ['t', 'f', 'g', 'h'], ['i', 'j', 'k', 'l'],
                     ['z', 'x', 'c', 'v'], ['b', 'n', 'm', ',']];
const allKeys = {};
let keyToChange;
let colorsUsed = [];
let keysUsed = [];

let shipForDeletion;

let allShipsElement;
let allShipsContainer;

function keyToString (key) {
  switch (key) {
    case "ArrowUp": return "↑";
    case "ArrowDown": return "↓";
    case "ArrowLeft": return "←";
    case "ArrowRight": return "→";
    default: return key;  
  }
}

function createColorShips(color) {
  function createColorShip(shipNoBackground, shipTransparent, color) {
    let canvasAux = document.createElement('canvas');
    canvasAux.width = shipNoBackground.width;
    canvasAux.height = shipNoBackground.height;
    let auxCtx = canvasAux.getContext('2d');  
    auxCtx.drawImage(shipNoBackground, 0, 0);
    auxCtx.globalCompositeOperation = "source-atop";
    auxCtx.fillStyle = color;
    auxCtx.fillRect(0, 0, canvasAux.width, canvasAux.height);
    auxCtx.drawImage(shipTransparent, 0, 0);
    return canvasAux;
  }
  return [createColorShip(shipNoBackgroundOff, shipTransparentOff, color),
          createColorShip(shipNoBackgroundOn, shipTransparentOn, color)]
}

function deleteShip(player) {
  let playerIndex = players.findIndex(p => p == player);
  player.configShipElement.parentNode.removeChild(player.configShipElement);
  document.body.removeChild(player.scoreDomElement);
  missiles = missiles.filter( m => m.shipOwner != player);
  KeysOfPlayers.push(player.keys);
  colors.push(player.color);
  keysUsed = keysUsed.filter(k => k != player.keys);
  colorsUsed = colorsUsed.filter(c => c != player.color);
  players.splice(playerIndex,1);
  createShipButton.disabled = false;
  createShipButton.style.cursor = "pointer";
}

class Player extends Mobile {
  constructor (pos, vel, dir, playerKeys) {
    super(pos, vel);
    this.dir = dir ?? Math.random()*2*Math.PI;
    this.angularVelocity = 0;
    this.score = 0;
    this.keys = playerKeys ?? KeysOfPlayers[0];
    keysUsed.push(KeysOfPlayers[0]);
    KeysOfPlayers.shift();
    this.color = colors[0];
    colorsUsed.push(colors[0]);
    colors.shift();
    [this.shipOff, this.shipOn] = createColorShips(this.color);
    this.radius = (this.shipOn.width + this.shipOn.height) / 4;
    
    for (let k of this.keys) allKeys[k] = false;

    this.shootingInterval = 1000;
    
    this.birthTime = 100;
    this.birthPulses = 4;
    this.opacityIncrement = this.birthPulses / this.birthTime;
    this.opacity = 0;

    this.fullFuel = 200;
    this.fuelForMissile = 20;
    this.explotionDuration = 100;
    
    this.scoreDomElement = document.createElement("span");
    this.scoreDomElement.classList.add("score");
    this.scoreDomElement.style.color = this.color;
    this.scoreDomElement.textContent = this.score;
    document.body.appendChild(this.scoreDomElement);

    this.configShipElement = document.createElement("div");
    this.iconShip = this.configShipElement.appendChild(this.shipOff);
    this.keysPanel = document.createElement("span");
    this.configShipElement.appendChild(this.keysPanel);
    this.colorButton = document.createElement("input");
    this.colorButton.type = "color";
    this.colorButton.value = this.color;
    this.colorButton.style.gridArea = "color";
    this.colorButton.addEventListener("input", event => this.updateColor(event.target.value));
    this.keysPanel.appendChild(this.colorButton);
    this.keysButtons = [];
    for (let i = 0; i < 4; i++) {
      this.keysButtons[i] = document.createElement("button");
      this.keysButtons[i].style.gridArea = `area${i+1}`;
      this.keysButtons[i].textContent = keyToString(this.keys[i]);
      this.keysButtons[i].addEventListener("click", () => {
        modal.style.display = "block";
        keyToChange = [this, i];
        document.querySelector(".modal-content").style.background = this.color;
      });
      this.keysPanel.appendChild(this.keysButtons[i]);
    }
    this.removeButton = document.createElement("button");
    this.removeButton.textContent = "🗑";
    this.removeButton.style.gridArea = "trash";
    this.removeButton.addEventListener("click", () => {
      shipForDeletion = this;
      confirmDelete.style.display = "block";
      document.querySelector(".deleteContent").style.background = this.color;
    });
    this.keysPanel.appendChild(this.removeButton);
        
    allShipsElement.appendChild(this.configShipElement);
  
    this.reborn();
  }    
  reborn () {
    this.pos = this.initialRandomPosition();
    this.vel = new Vec(0,0); // Vec.randomVector(-1, 1, -1, 1);
    this.angularVelocity = 0;
    this.dir = Math.random()*2*Math.PI;
    this.canShoot = true;
    this.fuel = this.fullFuel;
    this.timeLeft = this.explotionDuration;
    this.dead = false;
    this.birthTime = 100;
  }
  initialRandomPosition () {
    let newPos;
    do {
      newPos = Vec.randomVector(this.radius*2, canvas.width - this.radius*2,
                                this.radius*2, canvas.height - this.radius*2);
    } while (newPos.distance(center) <= solRadius + this.radius*3 ||
             players.find( p => newPos.distance(p.pos) <= (this.radius + p.radius)*3));
    return newPos;
  }
  updateColor(color) {
    colorsUsed = colorsUsed.map(c => c == this.color ? color : c);
    this.color = color;
    [this.shipOff, this.shipOn] = createColorShips(color);
    this.scoreDomElement.style.color = color;
    this.configShipElement.replaceChild(this.shipOff, this.iconShip);
    this.iconShip = this.shipOff;
    missiles.forEach( m => {if (m.shipOwner == this) {m.color = this.color} });    
  }
  updateFuel (deltaT) {
    this.fuel = Math.min( this.fullFuel, this.fuel + 600/Math.pow(this.pos.distance(center),2) * deltaT);
  }
  updateVelocity (deltaT) {
    super.updateVelocity(deltaT);
    if (allKeys[this.keys[2]] && !this.dead) {
      let dirVersor = new Vec( Math.cos(this.dir), Math.sin(this.dir));
      this.vel = this.vel.plus(dirVersor.times(.005*deltaT));
      this.fuel = Math.max( 0, this.fuel - 1);
    }
  }
  updateDirection (deltaT) {
    this.dir += this.angularVelocity * deltaT;
    if (allKeys[this.keys[1]] || allKeys[this.keys[3]]) {
      this.angularVelocity += (allKeys[this.keys[3]] - allKeys[this.keys[1]]) * .000005 * deltaT;
      this.fuel = Math.max( 0, this.fuel - 0.1 );
    }
  }
  updateScore () {
    this.scoreDomElement.textContent = this.score;
    this.scoreDomElement.classList.add("zoom");
    setTimeout( () => this.scoreDomElement.classList.remove("zoom"), 700);
  }
  redraw (canvas) {
    let ship = (allKeys[this.keys[2]] && !this.dead && !this.birthTime) ? this.shipOn : this.shipOff;
    if (this.dead) {
      canvas.save();
      canvas.globalAlpha = this.timeLeft/this.explotionDuration;
    } else if (this.birthTime) {
      canvas.save();
      this.opacity += this.opacityIncrement;
      canvas.globalAlpha = this.opacity;
      if (this.opacity <= 0 || this.opacity >= 1) this.opacityIncrement *= -1; 
      this.birthTime--;
    }
    drawImage(ship, this.pos, this.dir, canvas);
    if (!this.dead) {
      this.drawFuelBar(canvas);
    }
    if (this.dead) {
      canvas.globalAlpha = this.computeLinearOpacity(0, .5, .9);
      drawImage(shipBurning0, this.pos.plus(Vec.randomVector(-3,3,-3,3)), 
                this.dir+Math.random()*.02-.01, canvas);
      canvas.globalAlpha = this.computeLinearOpacity(.4, .75, 1);
      drawImage(shipBurning1, this.pos.plus(Vec.randomVector(-3,3,-3,3)), 
                this.dir+Math.random()*.02-.01, canvas);                
    }
    if (this.dead || this.birthTime >= -10) {
      canvas.restore();
    }
  }
  computeLinearOpacity (xBegin, xMax, xEnd) {
    let x = 1 - this.timeLeft / this.explotionDuration;
    if (x <= xBegin || x >= xEnd) return 0;
    if (x > xBegin && x <= xMax) return (x - xBegin) / (xMax - xBegin);
    if (x > xMax) return (xEnd - x) / (xEnd - xMax);
  }
  drawFuelBar (canvas) {
    canvas.fillStyle = "lightgreen";    
    canvas.strokeStyle = "lightgreen";
    let xFuelBar = this.pos.x - this.radius*1.2;
    let yFuelBar = this.pos.y - this.radius*1.2;
    canvas.fillRect(xFuelBar, yFuelBar, this.fuel / this.fullFuel * this.radius, 3);
    canvas.strokeRect(xFuelBar, yFuelBar, this.radius, 3);
  }
  move (deltaT) {
    if (!this.birthTime) {
      super.move(deltaT);
    }
    if (!this.dead && !this.birthTime) { 
      this.updateDirection(deltaT);   
      this.updateFuel(deltaT);
      this.shootMissile();
    }
  }
  shootMissile () {
    if (this.canShoot && allKeys[this.keys[0]] && this.fuel >= this.fuelForMissile) {
      let missile = new Missile(this.pos.plus(Vec.fromPolar(this.shipOn.width/1.8,this.dir)), 
                                this.vel.plus(Vec.fromPolar(2, this.dir)),
                                this);
      missiles.push(missile);
      this.canShoot = false;
      this.fuel -= this.fuelForMissile;
      setTimeout( () => this.canShoot = true, this.shootingInterval);      
    }
  }
  explodes () {
    this.dead = true;
  }
  burns () {
    this.dead = true;
  }
}

class Missile extends Mobile {
  constructor(pos, vel, ship) {
    super(pos, vel);
    this.radius = 7;
    this.shipOwner = ship;
    this.color = ship.color;
    this.radiusPlus = 1;
    this.radiusIncrement = .05;
    this.explotionDuration = 40;
    this.timeLeft = this.explotionDuration;
    this.dead = false;
  }
  redraw (canvas) {
    if (this.dead) {
      canvas.save();
      canvas.globalAlpha = this.timeLeft/this.explotionDuration;
    } 
    canvas.beginPath();
    let radialGradient = canvas.createRadialGradient(this.pos.x, this.pos.y, 0, 
                                                    this.pos.x, this.pos.y, this.radius * this.radiusPlus);
    radialGradient.addColorStop(0, this.color);
    radialGradient.addColorStop(.5/this.radiusPlus, this.color);
    radialGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
    canvas.fillStyle = radialGradient;
    canvas.arc(this.pos.x, this.pos.y, this.radius * this.radiusPlus, 0, 6.29, false);
    canvas.fill();   
    this.radiusPlus += this.radiusIncrement;
    if (this.radiusPlus <= 1 || this.radiusPlus >= 2) this.radiusIncrement *= -1;
    if (this.dead) {
      canvas.restore();
    }
  }
  explodes () {
    this.dead = true;
  }
}

// Sol tomado de: https://gravityartanddesign.com/portfolio_page/call-the-sun/
let sol = new Image();
let solBlinkOne = new Image();
let solBlinkTwo = new Image();
let solRadius;
sol.onload = () => solRadius = sol.height / 2 ;
sol.src = "sun/Sun.png";
solBlinkOne.src = "sun/Sun-blink-1.png";
solBlinkTwo.src = "sun/Sun-blink-2.png";
let solBlinking = false;
let solBlink;
let center = new Vec(window.innerWidth/2, window.innerHeight/2);

let shipNoBackgroundOff = new Image();
let shipNoBackgroundOn = new Image();
let shipTransparentOff = new Image();
let shipTransparentOn = new Image();
let shipBurning0 = new Image();
let shipBurning1 = new Image();

let missiles = [];
let players = [];

let paused = false;
let pause;
let modal;
let confirmDelete;

let createShipButton;

let languageSelector, helpIcon;

let helpShip, helpShipCanvas;

function start() {
    let canvasElement = document.getElementById("canvas");
    let canvas = canvasElement.getContext("2d");
    canvasElement.width = window.innerWidth;
    canvasElement.height = window.innerHeight;

    modal = document.querySelector(".modal");
    modal.addEventListener("click", e => {
      if(e.target == modal){
        modal.style.display = "none";
      }
    });
    document.querySelector(".close-btn").addEventListener("click", () => modal.style.display = "none");

    confirmDelete = document.querySelector(".confirmDelete");
    document.querySelector("#yes").addEventListener("click", () => {
      deleteShip(shipForDeletion);
      confirmDelete.style.display = "none";
    });
    document.querySelector("#no").addEventListener("click", () => confirmDelete.style.display = "none");

    helpIcon = document.querySelector(".helpIcon");
    helpIcon.addEventListener("click", () => helpScreen.style.display = "block");
    helpScreen = document.querySelector(".helpModal");
    helpScreen.addEventListener("click", e => {
      if (e.target == helpScreen) {
        helpScreen.style.display = "none";
      }
    });
    document.querySelector(".close-btn-help").addEventListener("click", () => helpScreen.style.display = "none");
    
    allShipsElement = document.querySelector(".naves");
    allShipsContainer = document.querySelector(".navesContainer");

    pause = document.querySelector(".pause");
    let configIcon = document.querySelector(".triple");
    // configIcon.style.cursor = "pointer";
    configIcon.addEventListener("click", () => {
      paused = !paused;
      document.querySelector(".configuration").classList.toggle("configurationHover");
      languageSelector.classList.toggle("show");
      helpIcon.classList.toggle("show");
      pause.style.display = paused ? "block" : "none";
    });

    createShipButton = document.querySelector("#createShip");
    createShipButton.addEventListener("click", () => {
      players.push(new Player());
      if (colors.length == 0) {
        createShipButton.disabled = true;
        createShipButton.style.cursor = "not-allowed";
      }
    });
    
    shipBurning1.onload = () => {
      players.push(new Player());
      players.push(new Player());

      languageSelector = document.querySelector(".language");
      languageSelector.addEventListener("change", event => changeLanguage(event.target.value));
      let userLang = (navigator.language || navigator.userLanguage).substring(0,2);
      languageSelector.value = userLang;
      changeLanguage(userLang);    
  
      helpShip = createColorShips("#FF756D");
      helpShipCanvas = document.querySelector("#shipHelpCanvas");
      helpShipCanvas.width = helpShip[0].width+20;
      helpShipCanvas.height = helpShip[0].height+20;
      helpShipCanvasContext = helpShipCanvas.getContext("2d");
      drawImage(helpShip[0], new Vec (helpShipCanvas.width-5, helpShipCanvas.height+5).times(.5), 
        0, helpShipCanvasContext);
      helpShipCanvasContext.fillStyle = "lightgreen";    
      helpShipCanvasContext.strokeStyle = "lightgreen";
      helpShipCanvasContext.fillRect(3, 3, helpShipCanvas.width/4, 3);
      helpShipCanvasContext.strokeRect(3, 3, helpShipCanvas.width/2.5, 3);

      dibujar(canvas);
    }
    
    let dirSize = canvasElement.width <= 1600 ? 100 : 150;

    shipNoBackgroundOff.src = `./ships/${dirSize}/ship-no-background-off.png`;
    shipNoBackgroundOn.src = `./ships/${dirSize}/ship-no-background-on.png`;
    shipTransparentOff.src = `./ships/${dirSize}/ship-transparent-off.png`;
    shipTransparentOn.src = `./ships/${dirSize}/ship-transparent-on.png`;
    shipBurning0.src = `./ships/${dirSize}/ship-burning-0.png`;
    shipBurning1.src = `./ships/${dirSize}/ship-burning-1.png`;
    
  }

let lastTime = null;
function dibujar(canvas, time) {
  if (!paused && lastTime) {
    canvas.clearRect(0,0,window.innerWidth,window.innerHeight);
    let deltaT = Math.min(time-lastTime, 100);
    // Players
    for (let player of players) {
      if (!player.dead) {
        if (player.tooCloseToSun()) {
          player.burns();
          player.score -= 1;
          player.updateScore();
          continue;
        }
        if (!player.birthTime) {
          let playerCollision = players.find (p => p != player && p.tooCloseTo(player));
          if (playerCollision) {
            for (let pp of [player, playerCollision]) {
              pp.explodes();
              pp.score--;
              pp.vel = player.vel.plus(playerCollision.vel);
              pp.updateScore();
            }
            continue;
          }        
          let missile = missiles.find ( m => player.tooCloseTo(m) && !m.dead );
          if (missile) {
            missile.explodes();
            player.explodes();
            missile.shipOwner.score++;
            player.score -= missile.shipOwner == player ? 2 : 1;
            player.updateScore();
            missile.shipOwner.updateScore();
            continue;
          }
        }
      } else {
        if (player.timeLeft == 0) {
          player.reborn();
          continue;
        }
        player.timeLeft--;
      }
      player.move(deltaT);
      player.redraw(canvas);  
    }
    // Missiles
    for (let missile of missiles) {
      if (missile.tooCloseToSun() || missile.timeLeft == 0) {
        missiles = missiles.filter( m => m != missile );
        missile = null;
        continue;
      } 
      if (missile.dead) {
        missile.timeLeft--;
        missile.radius++;
      } 
      missile.move(deltaT);
      missile.redraw(canvas);
    }
    
    drawImage(solBlinking ? solBlink : sol, center, 0, canvas);  
    if (!solBlinking && Math.random() < .01) {
        solBlinking = true;
        solBlink = Math.random() < .5 ? solBlinkOne : solBlinkTwo;
        setTimeout( ()=> solBlinking = false, Math.random()*400 + 100);
    }                
  }
  lastTime = time;
  requestAnimationFrame( time => dibujar(canvas, time) );    
}

window.addEventListener("keydown", event => {
  if (modal.style.display == "block") {
    let [player, key] = keyToChange;
    player.keys[key] = event.key;
    allKeys[event.key] = false;
    player.keysButtons[key].textContent = keyToString(event.key);
    modal.style.display = "none";
    return;
  }
  if (allKeys.hasOwnProperty(event.key)) {
    allKeys[event.key] = true;
    event.preventDefault();
    }
  });
window.addEventListener("keyup", event => {
  if (allKeys.hasOwnProperty(event.key)) {
    allKeys[event.key] = false;
    event.preventDefault();
    }
});

function drawImage(image, pos, rotation, ctx) {
  ctx.setTransform(1, 0, 0, 1, pos.x, pos.y); 
  ctx.rotate(rotation);
  ctx.drawImage(image, -image.width / 2, -image.height / 2);
  ctx.setTransform(1,0,0,1,0,0);
}

function drawRotatedImage(image, pos, angle, canvas) {
    canvas.save();
    canvas.translate(pos.x, pos.y);
    canvas.rotate(angle);
    canvas.drawImage(image, -image.width/2,-image.height/2);
    canvas.restore();
}

function drawImageWithScale(image, pos, scale, rotation, ctx) {
    ctx.setTransform(scale, 0, 0, scale, pos.x, pos.y); // sets scale and origin
    ctx.rotate(rotation);
    ctx.drawImage(image, -image.width / 2, -image.height / 2);
    ctx.setTransform(1,0,0,1,0,0);
} 

function changeLanguage (language) {
  switch (language) {
    case "es":  // ESPAÑOL
      document.querySelector("title").textContent = "Gravity Ships: El juego";
      document.querySelector("#createShip").textContent = "AÑADIR NAVE";      
      document.querySelector("#pressKey").textContent = "Pulsa una tecla...";
      document.querySelector("#confirmShipDelete").innerHTML = "¿<em>Realmente</em> quieres borrar esta nave?";
      document.querySelector("#yes").textContent = "¡Sí!";
      document.querySelector("#no").textContent = "No...";
      helpIcon.textContent = "ayuda";
      break;
     case "en": // ENGLISH (DEFAULT)
     default:
      document.querySelector("title").textContent = "Gravity Ships: the game";
      document.querySelector("#createShip").textContent = "ADD NEW SHIP";
      document.querySelector("#pressKey").textContent = "Press any key...";
      document.querySelector("#confirmShipDelete").innerHTML = "Do you <em>really</em> want to delete this ship?";
      document.querySelector("#yes").textContent = "Yes!";
      document.querySelector("#no").textContent = "No...";
      helpIcon.textContent = "help";
      break;
  }
} 