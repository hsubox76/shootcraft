// Main namespace
var buildApp = {};

// Button numerical value constants
buildApp.BUTTONS = {};
buildApp.BUTTONS.W = 87;
buildApp.BUTTONS.S = 83;
buildApp.BUTTONS.A = 65;
buildApp.BUTTONS.D = 68;
buildApp.BUTTONS.SHIFT = 16;
buildApp.BUTTONS.CTRL = 17;
buildApp.BUTTONS.SPACE = 32;
buildApp.BUTTONS.TAB = 9;
buildApp.BUTTONS.LMB = 0;
buildApp.BUTTONS.RMB = 2;
buildApp.BUTTONS.NoButton = -1;

// Colors
buildApp.palette = [
  { html: '#cc3333', hex: 0xcc3333}, // red
  { html: '#FE9244', hex: 0xfe9244}, // orange
  { html: '#FEDB38', hex: 0xfedb38}, // yellow
  { html: '#54AA5A', hex: 0x54AA5A}, // green
  { html: '#0088cc', hex: 0x0088cc}, // blue
  { html: '#aa88cc', hex: 0xaa88cc}  // purple
];

// interface mode - look, build, shoot
buildApp.mode = 'none';

// Basic scene stats
buildApp.size = 5000;
buildApp.cubeSize = 100;
buildApp.gravity = -1;

// Viewbox
buildApp.containerWidth = document.getElementById('container').clientWidth;
buildApp.containerHeight = document.getElementById('container').clientHeight;
buildApp.containerTop = 0;
buildApp.containerLeft = 0;

// Movement vars
buildApp.strideLength = 50;
buildApp.turnSpeed = 0.5;
buildApp.playerHeight = 200;
buildApp.playerVelocity = 0;

// Shooting vars
buildApp.shootVelocity = 50;
buildApp.shotObjects = [];
buildApp.shotMinInterval = 500; // limits rate of fire
buildApp.cooldownOn = false;

buildApp.camVector = new THREE.Vector3();

// Mouse move tracker
buildApp._moveCurr = new THREE.Vector2();
buildApp._movePrev = new THREE.Vector2();

buildApp.objects = [];
buildApp.blockMats = [];


// ================
// Helper functions
// ================

// From Three.JS Trackball Controls library
// gets vector starting at center of screen going toward mouse position
buildApp.getMouseOnCircle = ( function () {

  var vector = new THREE.Vector2();

  return function ( pageX, pageY ) {

    vector.set(
      ( ( pageX - buildApp.containerWidth * 0.5 - buildApp.containerLeft ) / ( buildApp.containerWidth * 0.5 ) ),
      ( ( buildApp.containerHeight + 2 * ( buildApp.containerTop - pageY ) ) / buildApp.containerWidth )
    );

    return vector;
  };

}() );

// Helper to get camera direction vector
buildApp.updateCamVector = function() {
  this.camVector.set(0,0,-1);
  this.camVector.applyQuaternion(this.camera.quaternion);
  return this.camVector;
};

// Get intersect value at mouse cursor
buildApp.getIntersect = function(e) {

    buildApp.mouse.set( (e.clientX / buildApp.containerWidth) * 2 - 1, - (e.clientY / buildApp.containerHeight) * 2 + 1);
    buildApp.raycaster.setFromCamera(buildApp.mouse, buildApp.camera);

    var intersects = buildApp.raycaster.intersectObjects(buildApp.objects);

    if (intersects.length > 0) {
      return intersects[0];
    } else {
      return null;
    }

};

// ================
// Classes/objs
// ================

// Class for new building blocks
buildApp.Block = function (mat) {
  this.mesh = new THREE.Mesh(buildApp.cubeGeo, mat);
  this.size = buildApp.cubeSize;
  this.shootDirection = new THREE.Vector3();
  buildApp.scene.add(this.mesh);
  buildApp.objects.push(this.mesh);
};


buildApp.Block.prototype.getIntersect = function(objects) {

  var currentDirection = new THREE.Vector3();
  var currentPosition = new THREE.Vector3();

  currentDirection.set(this.shootDirection.x * this.velocity, this.yVelocity,
    this.shootDirection.z * this.velocity).normalize();

  currentPosition.set(this.mesh.position.x, this.mesh.position.y-this.size/2, this.mesh.position.z);

  this.raycaster.set(currentPosition, currentDirection);
  this.raycaster.far = this.size*2;
  this.raycaster.near = this.size;

  var intersects = this.raycaster.intersectObjects(objects);
  if (intersects.length > 0) {
    return intersects[0];
  }
  return null;
};

buildApp.Block.prototype.landAndSnap = function(intersect) {

  this.mesh.position.copy(intersect.point).add(intersect.face.normal);
  this.mesh.position.divideScalar(this.size).floor().multiplyScalar(this.size).addScalar(this.size/2);

};

buildApp.Hud = function () {
  this.mode = 'none';
  this.modeImages = {
    'none': '',
    'look': 'eye_icon_2.png',
    'build': 'cube_icon.png',
    'delete': 'delete_icon.png'
  };
};

buildApp.Hud.prototype.changeMode = function (mode) {
  var bgImage = this.modeImages[mode];
  if (bgImage) {
    bgImage = "url('lib/images/" + bgImage + "')";
  }
  this.modeEl.style.backgroundImage = bgImage;
};

buildApp.Hud.prototype.changeAmmo = function (ammoIndex) {
  var color = buildApp.palette[ammoIndex].html;

  this.ammoEl.style.backgroundColor = color;
};

// =============================
// Mouse/keyboard event handlers
// =============================

buildApp.onKeyDown = function(event) {
  
  event.preventDefault();

  if (event.keyCode === buildApp.BUTTONS.W) {
    buildApp.walk(0,1);
  }
  if (event.keyCode === buildApp.BUTTONS.S) {
    buildApp.walk(0,-1);
  }
  if (event.keyCode === buildApp.BUTTONS.A) {
    buildApp.walk(-1,0);
  }
  if (event.keyCode === buildApp.BUTTONS.D) {
    buildApp.walk(1,0);
  }
  if (event.keyCode === buildApp.BUTTONS.SPACE) {
    buildApp.shoot();
  }
  if (event.keyCode === buildApp.BUTTONS.SHIFT) {
    buildApp.mode = 'build';
    buildApp.hud.changeMode('build');
    document.addEventListener('keyup', buildApp.onKeyUp, false);
  }
  if (event.keyCode === buildApp.BUTTONS.CTRL) {
    buildApp.mode = 'delete';
    buildApp.hud.changeMode('delete');
    document.addEventListener('keyup', buildApp.onKeyUp, false);
  }
  if (event.keyCode === buildApp.BUTTONS.TAB) {
    buildApp.currentMat += 1;
    if (buildApp.currentMat >= buildApp.blockMats.length) {
      buildApp.currentMat = 0;
    }
    buildApp.hud.changeAmmo(buildApp.currentMat);
  }
};

buildApp.onKeyUp = function(event) {

  event.preventDefault();

  if (buildApp.mode === 'build' || buildApp.mode === 'delete') {
    buildApp.mode = 'none';
    buildApp.hud.changeMode('none');
    buildApp.rollOverMesh.visible = false;
    //buildApp.render();
    document.removeEventListener('keyup', buildApp.onKeyUp);
  }

};

// encompasses mouse-hold-down for look mode and mouse clicks for build/destroy
buildApp.onMouseDown = function(event) {
  
  event.preventDefault();

  if (event.button === buildApp.BUTTONS.LMB) { // look mode

    buildApp._moveCurr.copy(buildApp.getMouseOnCircle(event.pageX, event.pageY));
    buildApp._movePrev.copy(buildApp._moveCurr);
    if (buildApp.mode === 'none') {
      buildApp.mode = 'look';
      buildApp.hud.changeMode('look');
    }

    document.addEventListener('mouseup', buildApp.onMouseUp, false );

    if (buildApp.mode === 'build' || buildApp.mode === 'delete') {

      var intersect = buildApp.getIntersect(event);

      if (intersect) {
        if (buildApp.mode === 'build') {
          buildApp.build(intersect);
        } else {
          if (intersect.object != buildApp.plane) {
            buildApp.scene.remove(intersect.object);
            buildApp.objects.splice(buildApp.objects.indexOf(intersect.object),1);
          }
        }
      }
    }
  }

};

// For look mode and for placing helper cube during build mode
buildApp.onMouseMove = function(event) {

  event.preventDefault();

  if (buildApp.mode === 'look') {

    buildApp._movePrev.copy(buildApp._moveCurr);
    buildApp._moveCurr.copy(buildApp.getMouseOnCircle(event.pageX, event.pageY));
    buildApp.turn(1);

   } else if (buildApp.mode === 'build') {

    var intersect = buildApp.getIntersect(event);

    if (intersect) {
      buildApp.projectCube(intersect);
    }

  }
};

buildApp.onMouseUp = function(event) {
  
  event.preventDefault();

  if (buildApp.mode === 'look') {
    buildApp.mode = 'none';
    buildApp.hud.changeMode('none');
  }

  //document.removeEventListener('mousemove', buildApp.onMouseMove);
  document.removeEventListener('mouseup', buildApp.onMouseUp);
};


// =================================
// Environment interaction functions
// =================================

// Find y height of terrain at next step
buildApp.lookAheadYHeight = function (x, z) {
  var lookAheadPosition = new THREE.Vector3(x, this.camera.position.y, z);
  var downVector = new THREE.Vector3(0, -1, 0);
  this.raycasterGround.set(lookAheadPosition, downVector);
  var intersects = this.raycasterGround.intersectObjects(this.objects);
  if (intersects.length > 0) {
    return intersects[0].point.y;
  }
};

// See if next step will collide with some terrain at face height
buildApp.lookAheadCollide = function (pos, x, z) {
  var lookAheadDirection = new THREE.Vector3(x, 0, z);
  var playerHeadPosition = new THREE.Vector3();
  playerHeadPosition.copy(pos);
  playerHeadPosition.y -= 50;
  lookAheadDirection.normalize();
  this.raycasterLookAhead.set(pos, lookAheadDirection);
  this.raycasterLookAhead.near = this.cubeSize/2;
  this.raycasterLookAhead.far = this.cubeSize;
  var intersects = this.raycasterLookAhead.intersectObjects(this.objects);
  if (intersects.length > 0) {
    return true;
  }
  return false;
};

// Walk camera fwd/back in response to keypress
buildApp.walk = function (directionX, directionZ) {
  var xUnits, zUnits, xComp, yComp;
  var direction;

  this.updateCamVector();

  var zVector = this.camVector.normalize();
  var xVector = new THREE.Vector3();

  xVector.crossVectors(this.camVector, this.camera.up).normalize();

  if (directionZ !== 0) { // walk fwd/back
    xComp = this.camVector.x;
    zComp = this.camVector.z;
    direction = directionZ;
  }
  if (directionX !== 0) { // strafe
    xComp = xVector.x;
    zComp = xVector.z;
    direction = directionX;
  }

  xUnits = direction * this.strideLength * xComp;
  zUnits = direction * this.strideLength * zComp;

  // Check for climb/collision/fall
  var nextYHeight = this.lookAheadYHeight(this.camera.position.x + xUnits, this.camera.position.z + zUnits);
  var nextStepCollide = this.lookAheadCollide(this.camera.position, xUnits, zUnits);

  if (!nextStepCollide) {
    this.camera.position.x += xUnits;
    this.camera.position.z += zUnits;
    // if player has to fall
    if (nextYHeight < this.camera.position.y - this.playerHeight) {
      this.startFall(nextYHeight + this.playerHeight);
    } else {
      this.camera.position.y = nextYHeight + this.playerHeight;
    }
  }
};


// Set parameters at start of fall
buildApp.startFall = function (fallToY) {
  this.playerYTarget = fallToY;
  this.playerFalling = true;
};

// Run each frame during fall
buildApp.fall = function () {
  // have player fall slower than blocks for better fall effect
  this.playerVelocity += this.gravity/4;
  if (this.camera.position.y + this.playerVelocity >= this.playerYTarget) {
    this.camera.position.y += this.playerVelocity;
  } else {
    this.camera.position.y = this.playerYTarget;
    this.playerFalling = false;
  }
};


// Turn camera in direction of mouse drag
buildApp.turn = function (delta) {

  // 2D drag direction of mouse
  var xMove = this._moveCurr.x - this._movePrev.x;
  var yMove = this._moveCurr.y - this._movePrev.y;

  var rotMult = delta * this.turnSpeed;

  this.camera.rotation.y += -xMove;
  this.camera.rotation.x += yMove;

  this._movePrev.copy(this._moveCurr);

};

// Project helper cube onto mouse location
buildApp.projectCube = function (intersect) {

  this.rollOverMesh.visible = true;
  this.rollOverMesh.position.copy(intersect.point).add(intersect.face.normal);
  this.rollOverMesh.position.divideScalar(this.cubeSize).floor().multiplyScalar(this.cubeSize).addScalar(this.cubeSize/2);


};

// Create new building block cube at mouse location
buildApp.build = function (intersect) {

  var block = new buildApp.Block(buildApp.blockMats[buildApp.currentMat]);
  block.mesh.position.copy(intersect.point).add(intersect.face.normal);
  block.mesh.position.divideScalar(buildApp.cubeSize).floor().multiplyScalar(buildApp.cubeSize).addScalar(buildApp.cubeSize/2);
      

};

// Launch a new block from gun
buildApp.shoot = function () {

  if (!this.cooldownOn) {
    var block = new buildApp.Block(buildApp.blockMats[buildApp.currentMat]);
    block.mesh.position.copy(this.camera.position);
    this.updateCamVector();
    block.shootDirection.copy(this.camVector).normalize();
    block.velocity = buildApp.shootVelocity;
    block.yVelocity = block.shootDirection.y * buildApp.shootVelocity;
    block.raycaster = new THREE.Raycaster();
    this.shotObjects.push(block);

    // set cooldown on after firing, to turn off after shotmininterval;
    this.cooldownOn = true;
    setTimeout(function () { buildApp.cooldownOn = false; }, buildApp.shotMinInterval);
  }

};

// Track and update all shot blocks while they are in the air.
buildApp.updateShotObjects = function () {

  var block;

  for (var i = 0; i < buildApp.shotObjects.length; i++) {
    block = this.shotObjects[i];
    var intersect = block.getIntersect(this.objects);
    // if it is going to collide
    if (intersect) {
      // remove from shotObjects array
      buildApp.shotObjects.splice(i,1);
      block.landAndSnap(intersect);
    } else {
      block.mesh.position.x += block.shootDirection.x * buildApp.shootVelocity;
      block.mesh.position.y += block.yVelocity;
      block.mesh.position.z += block.shootDirection.z * buildApp.shootVelocity;
      block.yVelocity += buildApp.gravity;
    }
  }
};

// ========================================
// Functions for building basic start scene
// ========================================

buildApp.createGroundPlane = function () {

  var lineGeo = new THREE.Geometry();
  var size = this.size, step = this.cubeSize;

  for (var i = -size/2; i <= size/2; i += step) {

    lineGeo.vertices.push( new THREE.Vector3(-size/2, 0, i));
    lineGeo.vertices.push( new THREE.Vector3(size/2, 0, i));

    lineGeo.vertices.push( new THREE.Vector3(i, 0, -size/2));
    lineGeo.vertices.push( new THREE.Vector3(i, 0, size/2));
  }

  var lineMat = new THREE.LineBasicMaterial( { color: 0x000000, opacity: 0.2, transparent: true } );
  var line = new THREE.Line(lineGeo, lineMat, THREE.LinePieces);
  this.scene.add(line);

  var planeGeo = new THREE.PlaneBufferGeometry( size, size );
  planeGeo.applyMatrix( new THREE.Matrix4().makeRotationX( - Math.PI / 2 ) );
  var planeMat = new THREE.MeshBasicMaterial( {color: 0x009900 });

  this.plane = new THREE.Mesh(planeGeo, planeMat);
  this.plane.visible = true;
  this.scene.add(this.plane);
  buildApp.objects.push(this.plane);

};

buildApp.createLights = function () {

  var ambientLight = new THREE.AmbientLight(0x555555);
  this.scene.add(ambientLight);

  var directionalLight = new THREE.DirectionalLight(0xffffff);
  directionalLight.position.set(1, 0.75, 0.5).normalize();
  this.scene.add(directionalLight);

};

// rollover helper cube (from three.js voxelpainter)

buildApp.createRolloverCube = function() {
  var rollOverGeo = new THREE.BoxGeometry( this.cubeSize, this.cubeSize, this.cubeSize );
  var rollOverMaterial = new THREE.MeshBasicMaterial( { color: 0xff0000, opacity: 0.5, transparent: true } );
  this.rollOverMesh = new THREE.Mesh( rollOverGeo, rollOverMaterial );
  this.rollOverMesh.visible = false;
  this.scene.add( this.rollOverMesh );
};

// define basic building block cube

buildApp.defineCube = function() {
  this.cubeGeo = new THREE.BoxGeometry(this.cubeSize, this.cubeSize, this.cubeSize);
  for (i = 0; i < buildApp.palette.length; i++) {
    this.blockMats.push(new THREE.MeshLambertMaterial({
      color: buildApp.palette[i].hex,
      shading: THREE.FlatShading
    }));
  }
  this.currentMat = 0;
};


// ============================================
// Init: basic scene components, event handlers
// ============================================

buildApp.init = function () {

  this.camera = new THREE.PerspectiveCamera(45, this.containerWidth/this.containerHeight, 1, 10000);
  this.camera.position.set(0, this.playerHeight, 1300);
  this.target = new THREE.Vector3();
  // best rotation order to avoid camera roll
  this.camera.rotation.order = "YXZ";

  this.scene = new THREE.Scene();

  // Raycasters for mouse build/destroy
  this.raycaster = new THREE.Raycaster();
  this.mouse = new THREE.Vector2();

  // Raycasters for player collision
  this.raycasterGround = new THREE.Raycaster();
  this.raycasterLookAhead = new THREE.Raycaster();

  this.createGroundPlane();
  this.createLights();

  this.createRolloverCube();
  this.defineCube();

  // Heads up display
  this.hud = new this.Hud();

  this.hud.modeEl = document.getElementById('mode');
  this.hud.ammoEl = document.getElementById('ammo');
  this.hud.changeAmmo(0);

  this.renderer = new THREE.WebGLRenderer({antialias: true});
  this.renderer.setClearColor(0xbbeeff);
  this.renderer.setPixelRatio(window.devicePixelRatio);
  this.renderer.setSize(this.containerWidth, this.containerHeight);
  this.container = document.getElementById('container');

  this.container.appendChild(this.renderer.domElement);

  // Resize display when window resizes
  window.onresize = function () {
    buildApp.renderer.setSize( buildApp.container.clientWidth, buildApp.container.clientHeight - 1 );

    buildApp.camera.aspect = buildApp.container.clientWidth/buildApp.container.clientHeight;
    buildApp.camera.updateProjectionMatrix();

    // Also need to update stored values of container dimensions, used by mouse interface
    buildApp.containerWidth = document.getElementById('container').clientWidth;
    buildApp.containerHeight = document.getElementById('container').clientHeight;

  };

  document.addEventListener('keydown', this.onKeyDown, false);
  document.addEventListener('mousedown', this.onMouseDown, false);
  document.addEventListener('mousemove', buildApp.onMouseMove, false);

};

// Render - called ~60 fps
// Updates physics objects (falling blocks/falling player) and renders scene
buildApp.render = function () {

  requestAnimationFrame(buildApp.render);

  buildApp.updateShotObjects();

  buildApp.renderer.render(buildApp.scene, buildApp.camera);

  if (buildApp.playerFalling === true) {
    buildApp.fall();
  }

};

buildApp.init();
buildApp.render();

