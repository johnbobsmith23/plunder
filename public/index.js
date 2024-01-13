
//import { io } from "https://cdn.socket.io/4.7.4/socket.io.esm.min.js";
    
const socket = io();
socket.on('connect', () => {
   console.log('Successfully connected!');
 });
import * as CANNON from 'https://cdn.skypack.dev/cannon-es';

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';


// Set up scene
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 300);
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
renderer.shadowMap.enabled = true
renderer.setPixelRatio(window.devicePixelRatio);

let physicsWorld;
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
   TWO: THREE.TOUCH.DOLLY_ROTATE,
   THREE: THREE.TOUCH.PAN
}

let frames = 0, prevTime = performance.now(), highlightedObject, highlightedModelIndex, isMouseDown;
let draggableObject;

let floor;

initPhysics();
createFloor();
addLight();

function initPhysics() {
   physicsWorld = new CANNON.World({
      allowSleep: true,
      gravity: new CANNON.Vec3(0, -9.81, 0),
   })
   physicsWorld.defaultContactMaterial.restitution = .2;
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
   const ambientLight = new THREE.AmbientLight(0xffffff, 1.0);
   scene.add(ambientLight);

   // Add directional light to cast shadows
   const directionalLight = new THREE.DirectionalLight(0xffffff, 5);
   directionalLight.position.set(5, 50, 5);
   directionalLight.castShadow = true; // Enable shadow casting for the light
   directionalLight.shadow.mapSize.width = 2048;
   directionalLight.shadow.mapSize.height = 2048;
   directionalLight.shadow.camera.left = -80;
   directionalLight.shadow.camera.right = 80;
   directionalLight.shadow.camera.top = 10;
   directionalLight.shadow.camera.bottom = -10;
   directionalLight.shadow.camera.near = 5;
   directionalLight.shadow.camera.far = 400;
   scene.add(directionalLight);
}

const models = [];

// Function to load a GLB model and add it to the scene
function loadModel(url, position) {
   const loader = new GLTFLoader();
   loader.load(`./assets/${url}`, (gltf) => {
      const mesh = gltf.scene;
      mesh.name = url;
      const body = new CANNON.Body({
         mass: 1,
         shape: new CANNON.Box(new CANNON.Vec3(1, 1, 1)),
         sleepTimeLimit: .1
      });
      body.mass = body.shapes[0].volume() * 1.13;
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
      model.mesh.isDraggable = true;
      
      scene.add(model.mesh);
      physicsWorld.addBody(model.body);
      models.push(model);
   });
}

// Load three GLB models
loadModel('move_dice.glb', new THREE.Vector3(-3, 0, 0));
loadModel('defend_dice.glb', new THREE.Vector3(0, 0, 0));
loadModel('attack_dice.glb', new THREE.Vector3(3, 0, 0));

let animate = false;

function render() {
   physicsWorld.fixedStep();
   frames++;

   if (animate)
   {
      for (const model of models)
      {
      model.mesh.position.copy(model.body.position)
      model.mesh.quaternion.copy(model.body.quaternion)
      let mesh = { name: model.mesh.name, position: model.mesh.position, quaternion: model.mesh.quaternion.toArray() };
      socket.emit('updateModel', (mesh));
      }
   }

   controls.update();
   renderer.render(scene, camera);
   requestAnimationFrame(render);
}

document.addEventListener('click', () => {
   throwDice();
});

function throwDice () {
   models.forEach((d, dIdx) => {

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

      d.body.allowSleep = true;
      animate = !animate;
   });
}

render();

socket.on('hello', (message) => {
   const time = performance.now();
   if ( time >= prevTime + 1000 ) {
   
      console.log( Math.round( ( frames * 1000 ) / ( time - prevTime ) ) );
      document.getElementById('fps').innerHTML = frames;
      
      frames = 0;
      prevTime = time;
   
   }
   socket.emit('count', message + 1);
});

socket.on('updatePosition', (mesh) => {
   let model = models.find(model => {
      return model.mesh.name == mesh.name;
   });
   
   model.mesh.position.copy(mesh.position);
   model.mesh.quaternion.fromArray(mesh.quaternion);
});


// Handle window resize
window.addEventListener('resize', () => {
   camera.aspect = window.innerWidth / window.innerHeight;
   camera.updateProjectionMatrix();
   renderer.setSize( window.innerWidth, window.innerHeight );
});