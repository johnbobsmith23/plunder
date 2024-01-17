const socket = io();
socket.on('connect', () => {
   console.log('Successfully connected!');
 });
import * as CANNON from 'https://cdn.skypack.dev/cannon-es';

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { OutlinePass } from 'three/addons/postprocessing/OutlinePass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import Stats from 'three/addons/libs/stats.module.js';

let stats;
stats = new Stats();
document.body.appendChild( stats.dom );
// Set up scene
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 300);
camera.updateProjectionMatrix();
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
camera.position.set(0, .5, 4).multiplyScalar(7);
//camera.position.z = 10;
const canvasEl = document.querySelector('#canvas');
var renderer = new THREE.WebGLRenderer({
   alpha: true,
   antialias: true,
   canvas: canvasEl
});

renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.setPixelRatio(window.devicePixelRatio);
document.body.appendChild(renderer.domElement);
var rect = renderer.domElement.getBoundingClientRect();
const models = [];

let physicsWorld;
let composer, outlinePass;

// Load a GLTF model (dice)
const loader = new GLTFLoader();

const controls = new OrbitControls(camera, renderer.domElement);

controls.enablePan = true;
controls.maxPolarAngle = Math.PI / 2;
controls.enableDamping = true;
controls.mouseButtons = {
   MIDDLE: THREE.MOUSE.ROTATE,
   RIGHT: THREE.MOUSE.PAN
}
controls.touches = {
   ONE: THREE.TOUCH.ROTATE,
   TWO: THREE.TOUCH.DOLLY_PAN
}

let frames = 0;
var draggableObject;

let floor;

initPhysics();
createFloor();
addLight();


function initPhysics() {
   physicsWorld = new CANNON.World({
      allowSleep: true,
      gravity: new CANNON.Vec3(0, -9.81 * 8, 0),
   });
   physicsWorld.defaultContactMaterial.restitution = .1;
}

function createFloor() {
   floor = new THREE.Mesh(
      new THREE.PlaneGeometry(200, 200),
      new THREE.MeshStandardMaterial({
         color: 0x808080,
         roughness: 0.1,
         opacity: .5
      })
   );
   floor.receiveShadow = true;
   floor.position.y = -7;
   floor.quaternion.setFromAxisAngle(new THREE.Vector3(-1, 0, 0), Math.PI * .5);
   scene.add(floor);

   const floorBody = new CANNON.Body({
      type: CANNON.Body.STATIC,
      shape: new CANNON.Plane(),
   });
   floorBody.position.copy(floor.position);
   floorBody.quaternion.copy(floor.quaternion);
   physicsWorld.addBody(floorBody);
}

function addLight() {
   const ambientLight = new THREE.AmbientLight(0xffffff, 1.5);
   scene.add(ambientLight);

   var pointLight = new THREE.PointLight(0xffffff, 3, 0, 0);
   pointLight.position.set(10, 10, 10);
   pointLight.castShadow = true;
   pointLight.shadow.mapSize.width = 2048;
   pointLight.shadow.mapSize.height = 2048;
   scene.add(pointLight);   
}

let i = 0;

// Function to load a GLB model and add it to the scene
function loadModel(url, position) {
   const loader = new GLTFLoader();
   loader.load(`./assets/${url}`, (gltf) => {
      const mesh = gltf.scene;
      const body = new CANNON.Body({
         mass: 1,
         shape: new CANNON.Box(new CANNON.Vec3(1, 1, 1)),
         sleepTimeLimit: .2
      });
      
      const model = {mesh, body};

      model.mesh.position.copy(position);
      model.body.position.copy(position);
      // Enable shadow casting for the model
      model.mesh.traverse((child) => {
         if (child.isMesh) {
               child.castShadow = true;
               child.receiveShadow = true;
         }
      });
      model.mesh.castShadow = true;
      model.mesh.receiveShadow = true;
      model.isDraggable = true;
      model.isSelected = false;
      model.name = url.slice(0,-4);
      
      scene.add(model.mesh);
      physicsWorld.addBody(model.body);
      models.push(model);
   });
}

// Load three GLB models
loadModel('move_dice.glb', new THREE.Vector3(-3, 0, 0));
loadModel('defend_dice.glb', new THREE.Vector3(0, -1, 0));
loadModel('attack_dice.glb', new THREE.Vector3(3, 0, 0));

initPostProcessing();

function initPostProcessing() {
   composer = new EffectComposer( renderer );

   const renderPass = new RenderPass(scene, camera);
   composer.addPass( renderPass );

   outlinePass = new OutlinePass( new THREE.Vector2( window.innerWidth, window.innerHeight ), scene, camera);
   outlinePass.edgeStrength = 3;
   composer.addPass( outlinePass );

   const outputPass = new OutputPass();
   composer.addPass( outputPass );
}

let animate = false;
let receivingAnimation = false;

let dragon;
function updatePhysics() {
   physicsWorld.fixedStep();
   
   for (const model of models)
   {
      if (model.isSelected) {
         raycaster.setFromCamera(mouse, camera);
         if (raycaster.ray.intersectPlane( _plane, _intersection )) {
            model.body.previousPosition.copy(model.body.position);
            model.body.position.copy( _intersection);
            model.body.velocity.setZero();
         }
      }
      if (dragon) {
         console.log('velocity');
         console.log(model.body.velocity);
         console.log(model.body.angularVelocity);
         dragon = false;
      }
      model.mesh.position.copy(model.body.position);
      model.mesh.quaternion.copy(model.body.quaternion);
   }
}
function render() {
   updatePhysics();
   frames++;
   
   if (!models.find(model => {return model.body.sleepState != 2;}))
   {
      receivingAnimation = false;
      animate = false;
   }

   for (const model of models)
   {
      if (animate && !receivingAnimation){
         let mesh = { name: model.name, position: model.mesh.position, quaternion: model.mesh.quaternion.toArray() };
         socket.emit('updateModel', (mesh));
      }
   }
   
   controls.update();
   composer.render();
   requestAnimationFrame(render);
   stats.update();
}

document.addEventListener('dblclick', () => {
   throwDice();
});

function throwDice () {
   if (animate) return;
   models.forEach((d, dIdx) => {
      if (!d.mesh.isSelected)
      {
         d.body.velocity.setZero();
         d.body.angularVelocity.setZero();

         d.body.position = new CANNON.Vec3(6, dIdx * 1.5, 0);
         d.mesh.position.copy(d.body.position);

         d.mesh.rotation.set(2 * Math.PI * Math.random(), 0, 2 * Math.PI * Math.random())
         d.body.quaternion.copy(d.mesh.quaternion);

         const force = 3 + 5 * Math.random();
         d.body.applyImpulse(
            new CANNON.Vec3(-force, force, 0),
            new CANNON.Vec3(0, 0, .2)
         );

         d.allowSleep = true;

         animate = true;
      }
   });
}

throwDice();
render();

socket.on('updatePosition', (mesh) => {
   let model = models.find(model => {
      return model.name == mesh.name;
   });
   
   model.body.position.copy(mesh.position);
   model.body.quaternion.set(...mesh.quaternion);
   receivingAnimation = true;
   animate = true;
});


// Handle window resize
window.addEventListener('resize', () => {
   camera.aspect = window.innerWidth / window.innerHeight;
   camera.updateProjectionMatrix();
   renderer.setSize( window.innerWidth, window.innerHeight );
   rect = renderer.domElement.getBoundingClientRect();
});

let timerGoing = false;

window.addEventListener('touchstart', (event) => {
   if (event.touches.length === 1){
      onMouseMove(event.touches[0]);
      onMouseDown(event.touches[0]);
   }
   return;
   if (!timerGoing) {
      timerGoing = true;
      controls.enableRotate = true;
      setTimeout(() => {
         if (timerGoing){
            controls.enableRotate = false;
            timerGoing = false;
            //document.getElementById('touch').innerHTML = "false";
         }
         else{
            //document.getElementById('touch').innerHTML = "true";
         }
      }, 200);
      return;
   }
   timerGoing = false;
});

window.addEventListener('touchend', () => {
   controls.enabled = true;
   stopDrag();
});

window.addEventListener('touchmove', (event) => {
   onMouseMove(event.touches[0]);
});

const _plane = new THREE.Plane();
const _worldPosition = new THREE.Vector3();
const _offset = new THREE.Vector3();
const _inverseMatrix = new THREE.Matrix4();
const _intersection = new THREE.Vector3();

window.addEventListener('mousedown', onMouseDown);

function onMouseDown(event) {
   document.getElementById('touch').innerHTML = 'mouseDown';
   updateMousePosition(event);
   if (outlinePass.selectedObjects.length > 0){
      console.log('objectFound');
      draggableObject = models.find(model => {return model.mesh === outlinePass.selectedObjects[0];});
      draggableObject.isSelected = true;
      draggableObject.body.wakeUp();
      _plane.setFromNormalAndCoplanarPoint( camera.getWorldDirection( _plane.normal ), draggableObject.mesh.position);
      if ( raycaster.ray.intersectPlane( _plane, _intersection ) ) {
         document.getElementById('touch').innerHTML = 'dragEnabled';
         controls.enabled = false;
         _inverseMatrix.copy( draggableObject.mesh.parent.matrixWorld ).invert();
         _offset.copy( _intersection ).sub( draggableObject.mesh.position );
      }
   }
}

window.addEventListener('mouseup', () => {
   stopDrag();
});

function stopDrag() {
   dragon = true;
   console.log('mouseup');
   if (draggableObject){
      draggableObject.body.velocity.copy(draggableObject.body.position.vsub(draggableObject.body.previousPosition).scale(60));
      draggableObject.body.angularVelocity.set(3 * Math.random(), 3 * Math.random(), 3 * Math.random());
      draggableObject.isSelected = false;
      draggableObject = undefined;
      outlinePass.selectedObjects = [];
   }
}

function onMouseMove(event) {
   updateMousePosition(event);
   if (draggableObject) {
      return;
   }
   const mesh = [];
   raycaster.setFromCamera(mouse, camera);
   if (raycaster.intersectObjects([...models.map(model => model.mesh)], true, mesh).length) {
      const model = models.find(model => {return model.mesh === mesh[0].object.parent;});
      if (model.isDraggable) {
         document.getElementById.innerHTML = 'highlight';
         outlinePass.selectedObjects = [model.mesh];
         _plane.setFromNormalAndCoplanarPoint(camera.getWorldDirection( _plane.normal ), model.mesh.position);
      }
   } else {
      outlinePass.selectedObjects = [];
      draggableObject = undefined;
   }
}

window.addEventListener('mousemove', onMouseMove);

function updateMousePosition(event) {   
   mouse.x = ( ( event.clientX - rect.left ) / ( rect.right - rect.left ) ) * 2 - 1;
   mouse.y = - ( ( event.clientY - rect.top ) / ( rect.bottom - rect.top) ) * 2 + 1;
}