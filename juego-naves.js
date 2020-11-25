class Vec {
    constructor(x, y) {
      this.x = x;
      this.y = y;
    }
    static fromPolar (rho, theta) {
      return new Vec (rho * Math.cos(theta), rho * Math.sin(theta));
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

const allKeys = {};

class Mobile {
  constructor (pos, vel) {
    this.pos = pos;
    this.vel = vel;    
    this.accel;
  }
  acceleration () {
    let vectorToSun = center.minus(this.pos);
    this.accel = vectorToSun.times( 10 / Math.pow(vectorToSun.magnitude, 3) );
  }
  updatePosition (deltaT) {
    let newPos = this.pos.plus(this.vel.times(.1*deltaT));
    newPos.x = newPos.x < 0 ? window.innerWidth : newPos.x > window.innerWidth ? 0 : newPos.x;
    newPos.y = newPos.y < 0 ? window.innerHeight : newPos.y > window.innerHeight ? 0 : newPos.y;
    this.pos = newPos;
  }
  updateVelocity (deltaT) {
    this.vel = this.vel.plus(this.accel.times(deltaT));
  }
  move (deltaT) {
    this.acceleration();
    this.updateVelocity(deltaT);
    this.updatePosition(deltaT);
  }
  tooCloseToSun () {
    return this.pos.distancia(center) < solRadius;
  }
  tooCloseTo (other) {
    return this.pos.distancia(other.pos) < this.radius + other.radius;
  }
}

let colors = ['Red', 'cyan'];

class Player extends Mobile {
  constructor (pos, dir, vel, shipNumber, playerKeys) {
    super(pos, vel);
    this.dir = dir;
    this.shipNumber = shipNumber;
    this.score = 0;
    this.keys = playerKeys;
    this.shipOff = new Image();
    this.shipOn = new Image();
    this.shipOn.onload = () => this.radius = this.shipOn.height / 2;
    this.shipOff.src = `ships/ship-${shipNumber}-off.png`;
    this.shipOn.src = `ships/ship-${shipNumber}-on.png`;

    for (let k of this.keys) allKeys[k] = false;

    this.shootingInterval = 1000;
    this.canShoot = true;

  }    
  updateVelocity (deltaT) {
    if (allKeys[this.keys[2]]) {
      let dirVersor = new Vec( Math.cos(this.dir), Math.sin(this.dir));
      this.vel = this.vel.plus(dirVersor.times(.005*deltaT));
    }
    this.vel = this.vel.plus(this.accel.times(deltaT));
  }
  updateDirection (deltaT) {
    this.dir += (allKeys[this.keys[1]] - allKeys[this.keys[0]]) * .005 * deltaT;
  }
  redraw (canvas) {
    let ship = allKeys[this.keys[2]] ? this.shipOn : this.shipOff;
    drawImage(ship, this.pos, this.dir, canvas);
  }
  move (deltaT) {
    super.move(deltaT);
    this.updateDirection(deltaT);   
  }
  shootMissile () {
    if (this.canShoot && allKeys[this.keys[3]]) {
      let missile = new Missile(this.pos.plus(Vec.fromPolar(this.shipOn.height/1.5,this.dir)), 
                                this.vel.plus(Vec.fromPolar(2, this.dir)),
                                this.shipNumber);
      missiles.push(missile);
      this.canShoot = false;
      setTimeout( () => this.canShoot = true, this.shootingInterval);      
    }
  }
}

class Missile extends Mobile {
  constructor(pos, vel, shipNumber) {
    super(pos, vel);
    this.radius = 7;
    this.shipOwner = shipNumber;
    this.color = colors[shipNumber];
    this.colorPhase = 0;
    this.colorIncrement = .02;
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
    canvas.arc(this.pos.x, this.pos.y, this.radius, 0, 6.29, false);
    canvas.fillStyle = this.color;
    canvas.fill();
    canvas.lineWidth = this.radius * 1.5;
    canvas.strokeStyle = `rgba(255, 255, 255, ${this.colorPhase})`;
    canvas.stroke();
    this.colorPhase += this.colorIncrement;
    if (this.colorPhase <= 0.1) this.colorIncrement = +0.01;
    if (this.colorPhase >= 0.5) this.colorIncrement = -0.01;
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
let solRadius;
sol.onload = () => solRadius = sol.height / 2 ;
sol.src = "Sun-2.png";
let center = new Vec(window.innerWidth/2, window.innerHeight/2);

function randomPolarVector (origin, rhoMin, rhoMax, thetaMin, thetaMax) {
  let vector = Vec.fromPolar(Math.random()*(rhoMax-rhoMin) + rhoMin, Math.random()*(thetaMax-thetaMin) + thetaMin);
  return vector.plus(origin);
}

let missiles = [];
let players = [];

function start() {
    let canvasElement = document.getElementById("canvas");
    let canvas = canvasElement.getContext("2d");
    canvasElement.width = window.innerWidth;
    canvasElement.height = window.innerHeight;

    players.push( new Player (randomPolarVector(center, 2*solRadius, window.innerWidth/2, 0, Math.PI),
                              Math.random()*2*Math.PI, 
                              new Vec(Math.random()*2-1, Math.random()*2-1), 
                              0, ["ArrowLeft", "ArrowRight", "ArrowDown", "ArrowUp"]) );
    players.push( new Player (randomPolarVector(center, 2*solRadius, window.innerWidth/2, 0, Math.PI),
                              Math.random()*2*Math.PI, 
                              new Vec(Math.random()*2-1, Math.random()*2-1), 
                              1, ["a", "d", "s", "w"]) );

    dibujar(canvas);
}

let lastTime = null;
function dibujar(canvas, time) {
  if (lastTime) {
    canvas.clearRect(0,0,window.innerWidth,window.innerHeight);
    
    drawImage(sol, center, 0, canvas);
    
    let deltaT = Math.min(time-lastTime, 100);
       // Players
    for (let player of players) {
      let missile = missiles.find ( m => player.tooCloseTo(m) && !m.dead );
      if (missile) {
        missile.explodes();
        players[missile.shipOwner].score++;
        player.score -= missile.shipOwner == player.shipNumber ? 2 : 1;
      }
      player.move(deltaT);
      player.redraw(canvas);    
      player.shootMissile();
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
  }
  lastTime = time;
  requestAnimationFrame( time => dibujar(canvas, time) );    
}

window.addEventListener("keydown", event => {
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