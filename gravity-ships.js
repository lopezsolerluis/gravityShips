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
    distancia(other) {
      return this.minus(other).magnitude;
    }
  }

const gravityMassConstant = 100; // GM, in physical terms

class Mobile {
  constructor (pos, vel) {
    this.pos = pos ?? Vec.randomPolarVector(center, 2*solRadius, window.innerWidth/2, 0, Math.PI);
    this.vel = vel ?? new Vec(0, 0); // Vec.randomVector(-1, 1, -1, 1);
    this.accel;
  }
  acceleration () {
    let vectorToSun = center.minus(this.pos);
    // if distance < 2, use distance=2 (¿Why? Because it painted me. :P)
    this.accel = vectorToSun.times( gravityMassConstant / Math.pow (Math.max(vectorToSun.magnitude, 2), 3) );
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
    return this.pos.distancia(center) <= solRadius + this.radius;
  }
  tooCloseTo (other) {
    return this.pos.distancia(other.pos) < this.radius + other.radius;
  }
}

let maxPlayers = 6;
let colors = ['#FFBF00', '#40E0D0', '#DFFF00', '#6495ED', '#DE3163', '#CCCCFF'];
let KeysOfPlayers = [["ArrowUp", "ArrowLeft", "ArrowDown", "ArrowRight"],
                     ["w", "a", "s", "d"], ['t', 'f', 'g', 'h'], ['i', 'j', 'k', 'l'],
                     ['z', 'x', 'c', 'v'], ['b', 'n', 'm', ',']];
const allKeys = {};
let keyToChange;
let colorsUsed = [];
let keysUsed = [];

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
  numPlayers--;
}

let numPlayers = 0;

class Player extends Mobile {
  constructor (pos, dir, vel, playerKeys) {
    super(pos, vel);
    this.dir = dir ?? Math.random()*2*Math.PI;
    this.score = 0;
    this.keys = playerKeys ?? KeysOfPlayers[0];
    this.color = colors[0];
    keysUsed.push(KeysOfPlayers[0]);
    KeysOfPlayers.shift();
    colorsUsed.push(colors[0]);
    colors.shift();
    [this.shipOff, this.shipOn] = createColorShips(this.color);
    this.radius = (this.shipOn.width + this.shipOn.height) / 4;
    
    for (let k of this.keys) allKeys[k] = false;

    this.shootingInterval = 1000;
    this.canShoot = true;

    this.birthTime = 100;
    this.birthPulses = 4;
    this.opacityIncrement = this.birthPulses / this.birthTime;
    this.opacity = 0;

    this.fullFuel = 200;
    this.fuel = this.fullFuel;
    this.explotionDuration = 100;
    this.timeLeft = this.explotionDuration;
    this.dead = false;

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
    this.removeButton.addEventListener("click", () => deleteShip(this));
    this.keysPanel.appendChild(this.removeButton);
        
    allShipsElement.appendChild(this.configShipElement);

    numPlayers++;    
  }    
  reborn () {
    this.pos = this.initialRandomPosition();
    this.vel = new Vec(0,0); // Vec.randomVector(-1, 1, -1, 1);
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
      newPos = Vec.randomVector(-canvas.width/2+this.radius,  canvas.width/2-this.radius,
                                -canvas.height/2+this.radius, canvas.height/2-this.radius);
    } while (newPos.distancia(center) <= solRadius || 
             players.find( p => p.pos.minus(newPos) <= this.radius + p.radius));
    return newPos.plus(center);
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
    this.fuel = Math.min( this.fullFuel, this.fuel + 300/Math.pow(this.pos.distancia(center),2) * deltaT);
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
    if (allKeys[this.keys[1]] || allKeys[this.keys[3]]) {
      this.dir += (allKeys[this.keys[3]] - allKeys[this.keys[1]]) * .003 * deltaT;
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
    this.drawFuelBar(canvas, ship);
    if (this.dead) {
      canvas.globalAlpha = 1 - this.timeLeft/this.explotionDuration;
      drawImage(shipBurning, this.pos.plus(Vec.randomVector(-5,5,-5,5)), 
                this.dir+Math.random()*.02-.01, canvas);
    }
    if (this.dead || this.birthTime >= -10) {
      canvas.restore();
    }
  }
  drawFuelBar (canvas, ship) {
    canvas.fillStyle = "lightgreen";    
    canvas.strokeStyle = "lightgreen";
    let xFuelBar = this.pos.x - ship.height/2;
    let yFuelBar = this.pos.y - ship.width/2;
    canvas.fillRect(xFuelBar, yFuelBar, this.fuel / this.fullFuel * ship.height/2, 3);
    canvas.strokeRect(xFuelBar, yFuelBar, ship.height/2, 3);
  }
  move (deltaT) {
    if (!this.birthTime) {
      super.move(deltaT);
    }
    if (!this.dead && !this.birthTime) { 
      this.updateDirection(deltaT);   
      this.updateFuel(deltaT);
    }
  }
  shootMissile () {
    if (this.canShoot && allKeys[this.keys[0]]) {
      let missile = new Missile(this.pos.plus(Vec.fromPolar(this.shipOn.width/1.8,this.dir)), 
                                this.vel.plus(Vec.fromPolar(2, this.dir)),
                                this);
      missiles.push(missile);
      this.canShoot = false;
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
let shipBurning = new Image();

let missiles = [];
let players = [];

let paused = false;
let pause;
let modal;

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

    allShipsElement = document.querySelector(".naves");
    allShipsContainer = document.querySelector(".navesContainer");

    pause = document.querySelector(".pause");
    let configIcon = document.querySelector(".triple");
    configIcon.style.cursor = "pointer";
    configIcon.addEventListener("click", () => {
      paused = !paused;
      document.querySelector(".configuration").classList.toggle("configurationHover");
      pause.style.display = paused ? "block" : "none";
    });
    
    shipTransparentOn.onload = () => {
      players.push(new Player());
      players.push(new Player());
      
      dibujar(canvas);
    }
    
    let dirSize = canvasElement.width <= 1600 ? 100 : 150;

    shipNoBackgroundOff.src = `./ships/${dirSize}/ship-no-background-off.png`;
    shipNoBackgroundOn.src = `./ships/${dirSize}/ship-no-background-on.png`;
    shipTransparentOff.src = `./ships/${dirSize}/ship-transparent-off.png`;
    shipTransparentOn.src = `./ships/${dirSize}/ship-transparent-on.png`;
    shipBurning.src = `./ships/${dirSize}/ship-burning.png`;
    
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
        let playerCollision = players.find (p => p != player && p.tooCloseTo(player));
        if (playerCollision) {
          player.explodes();
          playerCollision.explodes();
          player.score--;
          playerCollision.score--;
          player.vel = player.vel.plus(playerCollision.vel);
          playerCollision.vel = playerCollision.vel.plus(player.vel);
          player.updateScore();
          playerCollision.updateScore();
          continue;
        }
        let missile = missiles.find ( m => player.tooCloseTo(m) && !m.dead );
        if (missile) {
          missile.explodes();
          missile.shipOwner.score++;
          player.score -= missile.shipOwner == player ? 2 : 1;
          player.explodes();
          player.updateScore();
          missile.shipOwner.updateScore();
          continue;
        }
        player.shootMissile();
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