
//import { io } from "https://cdn.socket.io/4.7.4/socket.io.esm.min.js";
    
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
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutlinePass } from 'three/addons/postprocessing/OutlinePass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { FXAAShader } from 'three/addons/shaders/FXAAShader.js';
import { GUI } from 'three/addons/libs/lil-gui.module.min.js';


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

let physicsWorld;
let composer, effectFXAA, outlinePass;

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

let frames = 0, prevTime = performance.now(), highlightedObject, highlightedModelIndex, isMouseDown;
let draggableObject;

let floor;

initPhysics();
createFloor();
addLight();

function initPhysics() {
   physicsWorld = new CANNON.World({
      allowSleep: true,
      gravity: new CANNON.Vec3(0, -9.81 * 8, 0),
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
   const ambientLight = new THREE.AmbientLight(0xffffff, 1.5);
   scene.add(ambientLight);

   var pointLight = new THREE.PointLight(0xffffff, 3, 0, 0);
   pointLight.position.set(10, 10, 10);
   pointLight.castShadow = true;
   pointLight.shadow.mapSize.width = 2048;
   pointLight.shadow.mapSize.height = 2048;
   scene.add(pointLight);   
}

const models = [];
let i = 0;

// Function to load a GLB model and add it to the scene
function loadModel(url, position) {
   const loader = new GLTFLoader();
   loader.load(`./assets/${url}`, (gltf) => {
      const mesh = gltf.scene;
      const body = new CANNON.Body({
         mass: 9.04,
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
      console.log(model.name);
      
      scene.add(model.mesh);
      physicsWorld.addBody(model.body);
      models.push(model);
   });
}

// Load three GLB models
loadModel('move_dice.glb', new THREE.Vector3(-3, 0, 0));
loadModel('defend_dice.glb', new THREE.Vector3(0, -1, 0));
loadModel('attack_dice.glb', new THREE.Vector3(3, 0, 0));

function initPostProcessing() {
   composer = new EffectComposer( renderer );

   const renderPass = new RenderPass( scene, camera );
   composer.addPass( renderPass );

   outlinePass = new OutlinePass( new THREE.Vector2( window.innerWidth, window.innerHeight ), scene, camera );
   composer.addPass( outlinePass );

   const outputPass = new OutputPass();
   composer.addPass( outputPass );

   effectFXAA = new ShaderPass( FXAAShader );
   effectFXAA.uniforms[ 'resolution' ].value.set( 1 / window.innerWidth, 1 / window.innerHeight );
   composer.addPass( effectFXAA );
}
initPostProcessing();

let animate = false;
let receivingAnimation = false;

function updatePhysics() {
   physicsWorld.fixedStep();
   
   for (const model of models)
   {
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
   //renderer.render(scene, camera);
   composer.render();
   requestAnimationFrame(render);
}

document.addEventListener('dblclick', () => {
   throwDice();
});

function throwDice () {
   if (animate) return;
   models.forEach((d, dIdx) => {
      if (!d.mesh.isSelected)
      {
         console.log(d.body.mass);
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
         d.body.sleepState = 0;
         animate = true;
      }
   });
}

throwDice();
render();

socket.on('hello', (message) => {
   const time = performance.now();
   if ( time >= prevTime + 1000 ) {
   
      //console.log( Math.round( ( frames * 1000 ) / ( time - prevTime ) ) );
      document.getElementById('fps').innerHTML = frames;
      
      frames = 0;
      prevTime = time;
   
   }
   socket.emit('count', message + 1);
});

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
   effectFXAA.uniforms[ 'resolution' ].value.set( 1 / window.innerWidth, 1 / window.innerHeight );
   renderer.setSize( window.innerWidth, window.innerHeight );
   rect = renderer.domElement.getBoundingClientRect();
});

let timerGoing = false;

window.addEventListener('touchstart', () => {
   if (!timerGoing) {
      timerGoing = true;
      controls.enableRotate = true;
      setTimeout(() => {
         if (timerGoing){
            controls.enableRotate = false;
            timerGoing = false;
            document.getElementById('touch').innerHTML = "false";
         }
         else{
            document.getElementById('touch').innerHTML = "true";
         }
      }, 200);
      return;
   }
   timerGoing = false;
})
window.addEventListener('touchend', () => {
   if (!timerGoing) controls.enableRotate = false;
});

// Allows user to pick up and drop objects on-click events
window.addEventListener("click", (event) => {
   if (draggableObject){
      draggableObject = undefined;
      return;
   }

   // If NOT 'holding' object on-click, set container to <object> to 'pickup' the object.
   updateMousePosition(event);
   raycaster.setFromCamera(mouse, camera);
   const found = raycaster.intersectObjects(models.map(model => model.mesh));
   if (found.length)
   {
      let current = found[0].object;
      while (current.parent.parent !== null) {
         current = current.parent;
      }
      if (!current.isSelected) {
         current.children[0].material.emissive.setHex(0x00ff00);
         current.isSelected = true;
      } else {
         current.children[0].material.emissive.setHex(0x000000);
         current.isSelected = false;
      }
      if (current.isDraggable) {
         console.log("drag");
         draggableObject = current;
      }
   }
});

function dragModel() {
   // If 'holding' an model, move the model
   if (draggableObject) {
         raycaster.setFromCamera(mouse, camera);
         const found = raycaster.intersectObjects(scene.children);
         if (found.length > 0) {
            for (let obj3d of found) {
               if (!obj3d.object.isDraggablee) {
                     draggableObject.position.x = obj3d.point.x;
                     draggableObject.position.z = obj3d.point.z;
               break;
               }
            }
         }
   }
}

function onMouseMove(event) {
   updateMousePosition(event);
   let model = getRaycasterIntersection();
   if (model) {
      outlinePass.selectedObjects = [model.mesh.children[0]];
      console.log(outlinePass.selectedObjects);
   }
   dragModel();
}


document.addEventListener('mousemove', onMouseMove);

function updateMousePosition(event) {   
   mouse.x = ( ( event.clientX - rect.left ) / ( rect.right - rect.left ) ) * 2 - 1;
   mouse.y = - ( ( event.clientY - rect.top ) / ( rect.bottom - rect.top) ) * 2 + 1;
}

function getRaycasterIntersection() {
   raycaster.setFromCamera(mouse, camera);
   const found = raycaster.intersectObjects(models.map(model => model.mesh));
   if (found.length)
   {
      outlinePass.selectedObjects.push(found[0].object);
      let current = found[0].object;
      while (current.parent.parent !== null) {
         console.log(current);
         current = current.parent;
      }
      return (models.find(model => {return model.mesh === current;}));
   }
}