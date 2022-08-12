import {
	ACESFilmicToneMapping,
	NoToneMapping,
	Box3,
	LoadingManager,
	Sphere,
	Color,
	DoubleSide,
	Mesh,
	MeshStandardMaterial,
	PlaneBufferGeometry,
	Group,
	MeshPhysicalMaterial,
	WebGLRenderer,
	Scene,
	PerspectiveCamera,
	OrthographicCamera,
	MeshBasicMaterial,
	sRGBEncoding,
	CustomBlending,
	Matrix4,
	GridHelper
} from 'three';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { LDrawLoader } from 'three/examples/jsm/loaders/LDrawLoader.js';
import { LDrawUtils } from 'three/examples/jsm/utils/LDrawUtils.js';
import { GUI } from 'three/examples/jsm/libs/lil-gui.module.min.js';
import Stats from 'three/examples/jsm/libs/stats.module.js';
import { PathTracingSceneWorker } from '../src/workers/PathTracingSceneWorker.js';
import { PhysicalPathTracingMaterial, PathTracingRenderer, MaterialReducer, BlurredEnvMapGenerator } from '../src/index.js';
import { FullScreenQuad } from 'three/examples/jsm/postprocessing/Pass.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

const envMaps = {
	'Royal Esplanade': 'https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/textures/equirectangular/royal_esplanade_1k.hdr',
	'Moonless Golf': 'https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/textures/equirectangular/moonless_golf_1k.hdr',
	'Overpass': 'https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/textures/equirectangular/pedestrian_overpass_1k.hdr',
	'Venice Sunset': 'https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/textures/equirectangular/venice_sunset_1k.hdr',
	'Small Studio': 'https://raw.githubusercontent.com/gkjohnson/3d-demo-data/master/hdri/studio_small_05_1k.hdr',
	'Pfalzer Forest': 'https://raw.githubusercontent.com/gkjohnson/3d-demo-data/master/hdri/phalzer_forest_01_1k.hdr',
	'Leadenhall Market': 'https://raw.githubusercontent.com/gkjohnson/3d-demo-data/master/hdri/leadenhall_market_1k.hdr',
	'Kloppenheim': 'https://raw.githubusercontent.com/gkjohnson/3d-demo-data/master/hdri/kloppenheim_05_1k.hdr',
	'Hilly Terrain': 'https://raw.githubusercontent.com/gkjohnson/3d-demo-data/master/hdri/hilly_terrain_01_1k.hdr',
	'Circus Arena': 'https://raw.githubusercontent.com/gkjohnson/3d-demo-data/master/hdri/circus_arena_1k.hdr',
	'Chinese Garden': 'https://raw.githubusercontent.com/gkjohnson/3d-demo-data/master/hdri/chinese_garden_1k.hdr',
	'Autoshop': 'https://raw.githubusercontent.com/gkjohnson/3d-demo-data/master/hdri/autoshop_01_1k.hdr',
};

const models = window.MODEL_LIST || {};
let initialModel = Object.keys(models)[0];
if (window.location.hash) {

	const modelName = window.location.hash.substring(1).replaceAll('%20', ' ');
	if (modelName in models) {

		initialModel = modelName;

	}

}

const params = {

	multipleImportanceSampling: true,
	acesToneMapping: true,
	resolutionScale: 1 / window.devicePixelRatio,
	tilesX: 1,
	tilesY: 1,
	samplesPerFrame: 1,

	model: initialModel,

	envMap: envMaps['Royal Esplanade'],

	gradientTop: '#bfd8ff',
	gradientBottom: '#ffffff',

	environmentIntensity: 3.0,
	environmentBlur: 0.0,
	environmentRotation: 0,

	cameraProjection: 'Orthographic',

	backgroundType: 'Gradient',
	bgGradientTop: '#111111',
	bgGradientBottom: '#000000',
	backgroundAlpha: 0.0,
	checkerboardTransparency: false,

	enable: true,
	bounces: 2,
	pause: false,



};

let container1, container2;
let creditEl, loadingEl, samplesEl;
let gui, stats, sceneInfo;
let renderer1, renderer2, camera1, camera2;
let ptRenderer1, ptRenderer2, fsQuad1, fsQuad2, scene;
let envMap, envMapGenerator;
let loadingModel = false;
let delaySamples = 0;
let group, controls1, controls2;


let mouseDown = false;
document.body.onmousedown = () => {
	mouseDown = true;
};
document.body.onmouseup = () => {
	mouseDown = false;
};


init();

async function init() {

	creditEl = document.getElementById('credits');
	loadingEl = document.getElementById('loading');
	samplesEl = document.getElementById('samples');

	scene = new Scene();
	scene.background = null;


	// Get a reference to the container element that will hold our scene
	container1 = document.querySelector('#scene-container-1');
	renderer1 = new WebGLRenderer({ antialias: true, alpha: true, outputEncoding: sRGBEncoding, toneMapping: ACESFilmicToneMapping, physicallyCorrectLights: true });
	renderer1.setSize(container1.clientWidth, container1.clientHeight);
	container1.append(renderer1.domElement);

	camera1 = new PerspectiveCamera(10, container1.clientWidth / container1.clientHeight, 0.025, 500);
	camera1.position.set(-3, 1.5, 0);
	camera1.lookAt(0, 0.25, -.5);

	ptRenderer1 = new PathTracingRenderer(renderer1);
	ptRenderer1.alpha = true;
	ptRenderer1.setSize(container1.clientWidth, container1.clientHeight);
	ptRenderer1.material = new PhysicalPathTracingMaterial();
	ptRenderer1.material.setDefine('FEATURE_GRADIENT_BG', 1);
	ptRenderer1.material.setDefine('FEATURE_MIS', Number(params.multipleImportanceSampling));
	ptRenderer1.material.bgGradientTop.set(params.bgGradientTop);
	ptRenderer1.material.bgGradientBottom.set(params.bgGradientBottom);
	ptRenderer1.material.backgroundAlpha = params.backgroundAlpha;
	ptRenderer1.camera = camera1;

	fsQuad1 = new FullScreenQuad(new MeshBasicMaterial({
		map: ptRenderer1.target.texture,
		blending: CustomBlending
	}));

	controls1 = new OrbitControls(camera1, renderer1.domElement);

	container2 = document.querySelector('#scene-container-2');
	renderer2 = new WebGLRenderer({ antialias: true, alpha: true, outputEncoding: sRGBEncoding, toneMapping: ACESFilmicToneMapping, physicallyCorrectLights: true });
	renderer2.setSize(container2.clientWidth, container2.clientHeight);
	container2.append(renderer2.domElement);

	camera2 = new PerspectiveCamera(10, container2.clientWidth / container2.clientHeight, 0.025, 500);
	camera2.position.set(0, 0.35, 2);
	camera2.lookAt(.65, 0.25, 0);

	ptRenderer2 = new PathTracingRenderer(renderer2);
	ptRenderer2.alpha = true;
	ptRenderer2.setSize(container2.clientWidth, container2.clientHeight);
	ptRenderer2.material = new PhysicalPathTracingMaterial();
	ptRenderer2.material.setDefine('FEATURE_GRADIENT_BG', 1);
	ptRenderer2.material.setDefine('FEATURE_MIS', Number(params.multipleImportanceSampling));
	ptRenderer2.material.bgGradientTop.set(new Color("white"));
	ptRenderer2.material.bgGradientBottom.set(new Color("white"));
	ptRenderer2.material.backgroundAlpha = params.backgroundAlpha;
	ptRenderer2.camera = camera2;

	fsQuad2 = new FullScreenQuad(new MeshBasicMaterial({
		map: ptRenderer2.target.texture,
		blending: CustomBlending
	}));

	controls2 = new OrbitControls(camera2, renderer2.domElement);

	envMapGenerator = new BlurredEnvMapGenerator(renderer1);

	stats = new Stats();
	document.body.appendChild(stats.dom);

	updateModel();
	updateEnvMap();
	onResize();

	animate();

	canvas1 = renderer1.domElement;
	canvas2 = renderer2.domElement;

	canvas1.addEventListener("mousedown", resetRenderer1);
	canvas2.addEventListener("mousedown", resetRenderer2);

	canvas1.addEventListener("mouseup", resetRenderer1);
	canvas2.addEventListener("mouseup", resetRenderer2);

	canvas1.addEventListener('mousemove', onMouseMove1);
	canvas2.addEventListener('mousemove', onMouseMove2);
	window.addEventListener('resize', onResize);

	canvas1.addEventListener('wheel', (event) => { resetRenderer1(); });
	canvas2.addEventListener('wheel', (event) => { resetRenderer2(); });

}

function onDocumentMouseUp(event) {
	resetRenderer();
}



function onMouseMove2(event) {

	if (mouseDown) {
		resetRenderer2();
	}


}

function onMouseMove1(event) {

	if (mouseDown) {
		resetRenderer1();
	}


}

function animate() {

	requestAnimationFrame(animate);

	stats.update();

	if (loadingModel) { return; }


	if (params.enable && delaySamples === 0) {

		const samples = Math.floor(ptRenderer1.samples);
		samplesEl.innerText = `samples: ${samples}`;


		ptRenderer1.material.materials.updateFrom(sceneInfo.materials, sceneInfo.textures);
		ptRenderer1.material.filterGlossyFactor = 0.5;
		ptRenderer1.material.environmentIntensity = params.environmentIntensity;
		ptRenderer1.material.bounces = params.bounces;
		ptRenderer1.material.physicalCamera.updateFrom(camera1);

		ptRenderer2.material.materials.updateFrom(sceneInfo.materials, sceneInfo.textures);
		ptRenderer2.material.filterGlossyFactor = 0.5;
		ptRenderer2.material.environmentIntensity = params.environmentIntensity;
		ptRenderer2.material.bounces = params.bounces;
		ptRenderer2.material.physicalCamera.updateFrom(camera2);

		camera1.updateMatrixWorld();
		camera2.updateMatrixWorld();

		if (!params.pause || ptRenderer1.samples < 1) {

			for (let i = 0, l = params.samplesPerFrame; i < l; i++) {
				ptRenderer1.update();
				ptRenderer2.update();
			}

		}


		renderer1.autoClear = false;
		fsQuad1.render(renderer1);
		renderer1.autoClear = true;
		controls1.update();


		renderer2.autoClear = false;
		fsQuad2.render(renderer2);
		renderer2.autoClear = true;
		controls2.update();

	} else if (delaySamples > 0) {

		delaySamples--;

	}

	samplesEl.innerText = `Samples: ${Math.floor(ptRenderer1.samples)}`;

}

function resetRenderer1() {
	if (params.tilesX * params.tilesY !== 1.0) {

		delaySamples = 1;

	}

	ptRenderer1.reset();
}

function resetRenderer2() {
	if (params.tilesX * params.tilesY !== 1.0) {

		delaySamples = 1;

	}

	ptRenderer2.reset();
}


function resetRenderer() {

	if (params.tilesX * params.tilesY !== 1.0) {

		delaySamples = 1;

	}

	ptRenderer1.reset();
	ptRenderer2.reset();
}

function onResize() {

	const scale = params.resolutionScale;
	const dpr = window.devicePixelRatio;

	renderer1.setSize(container1.clientWidth, container1.clientHeight);
	renderer1.setPixelRatio(window.devicePixelRatio * scale);
	ptRenderer1.setSize(container1.clientWidth * scale * dpr, container1.clientHeight * scale * dpr);
	ptRenderer1.reset();

	renderer2.setSize(container2.clientWidth, container2.clientHeight);
	renderer2.setPixelRatio(window.devicePixelRatio * scale);
	ptRenderer2.setSize(container2.clientWidth * scale * dpr, container2.clientHeight * scale * dpr);
	ptRenderer2.reset();


	camera1.aspect = container1.clientWidth / container1.clientHeight;
	camera2.aspect = container2.clientWidth / container2.clientHeight;

	camera1.updateProjectionMatrix();
	camera2.updateProjectionMatrix();
}

function buildGui() {

	if (gui) {

		gui.destroy();

	}

	gui = new GUI();

	gui.add(params, 'model', Object.keys(models)).onChange(updateModel);

	const pathTracingFolder = gui.addFolder('path tracing');
	pathTracingFolder.add(params, 'enable');
	pathTracingFolder.add(params, 'pause');
	pathTracingFolder.add(params, 'multipleImportanceSampling').onChange(v => {

		ptRenderer1.material.setDefine('FEATURE_MIS', Number(v));
		ptRenderer1.reset();

		ptRenderer2.material.setDefine('FEATURE_MIS', Number(v));
		ptRenderer2.reset();


	});
	pathTracingFolder.add(params, 'acesToneMapping').onChange(v => {

		renderer1.toneMapping = v ? ACESFilmicToneMapping : NoToneMapping;
		renderer2.toneMapping = v ? ACESFilmicToneMapping : NoToneMapping;

	});
	pathTracingFolder.add(params, 'bounces', 1, 20, 1).onChange(() => {

		ptRenderer.reset();

	});

	const resolutionFolder = gui.addFolder('resolution');
	resolutionFolder.add(params, 'resolutionScale', 0.1, 1.0, 0.01).onChange(() => {

		onResize();

	});
	resolutionFolder.add(params, 'samplesPerFrame', 1, 10, 1);
	resolutionFolder.add(params, 'tilesX', 1, 10, 1).onChange(v => {

		ptRenderer1.tiles.x = v;
		ptRenderer2.tiles.x = v;

	});
	resolutionFolder.add(params, 'tilesY', 1, 10, 1).onChange(v => {

		ptRenderer.tiles.y = v;

	});
	resolutionFolder.add(params, 'cameraProjection', ['Perspective', 'Orthographic']).onChange(v => {

		updateCamera(v);

	});
	resolutionFolder.open();

	const environmentFolder = gui.addFolder('environment');
	environmentFolder.add(params, 'envMap', envMaps).name('map').onChange(updateEnvMap);
	environmentFolder.add(params, 'environmentBlur', 0.0, 1.0).onChange(() => {

		updateEnvBlur();
		ptRenderer1.reset();
		ptRenderer2.reset();

	}).name('env map blur');
	environmentFolder.add(params, 'environmentIntensity', 0.0, 10.0).onChange(() => {

		ptRenderer1.reset();
		ptRenderer2.reset();
	}).name('intensity');
	environmentFolder.add(params, 'environmentRotation', 0, 2 * Math.PI).onChange(v => {

		ptRenderer1.material.environmentRotation.setFromMatrix4(new Matrix4().makeRotationY(v));
		ptRenderer1.reset();

		ptRenderer2.material.environmentRotation.setFromMatrix4(new Matrix4().makeRotationY(v));
		ptRenderer2.reset();

	});
	environmentFolder.open();

	const backgroundFolder = gui.addFolder('background');
	backgroundFolder.add(params, 'backgroundType', ['Environment', 'Gradient']).onChange(v => {

		ptRenderer1.material.setDefine('FEATURE_GRADIENT_BG', Number(v === 'Gradient'));
		ptRenderer2.material.setDefine('FEATURE_GRADIENT_BG', Number(v === 'Gradient'));
		if (v === 'Gradient') {

			scene.background = null;

		} else {

			scene.background = null;

		}

		ptRenderer1.reset();
		ptRenderer2.reset();

	});
	backgroundFolder.addColor(params, 'bgGradientTop').onChange(v => {

		ptRenderer1.material.bgGradientTop.set(v);
		ptRenderer1.reset();


		ptRenderer2.material.bgGradientTop.set(v);
		ptRenderer2.reset();

	});
	backgroundFolder.addColor(params, 'bgGradientBottom').onChange(v => {

		ptRenderer1.material.bgGradientBottom.set(v);
		ptRenderer1.reset();


		ptRenderer2.material.bgGradientBottom.set(v);
		ptRenderer2.reset();

	});
	backgroundFolder.add(params, 'backgroundAlpha', 0, 1).onChange(v => {

		ptRenderer1.material.backgroundAlpha = v;
		ptRenderer1.reset();

		ptRenderer2.material.backgroundAlpha = v;
		ptRenderer2.reset();


	});
	backgroundFolder.add(params, 'checkerboardTransparency').onChange(v => {

		if (v) document.body.classList.add('checkerboard');
		else document.body.classList.remove('checkerboard');

	});

}

function updateEnvMap() {

	new RGBELoader()
		.load(params.envMap, texture => {

			if (scene.environmentMap) {

				scene.environment.dispose();
				envMap.dispose();

			}

			envMap = texture;
			updateEnvBlur();
			ptRenderer1.reset();

			ptRenderer2.reset();

		});

}

function updateEnvBlur() {

	const blurredEnvMap = envMapGenerator.generate(envMap, params.environmentBlur);
	ptRenderer1.material.envMapInfo.updateFrom(blurredEnvMap);
	ptRenderer2.material.envMapInfo.updateFrom(blurredEnvMap);


	scene.environment = blurredEnvMap;


}



function convertOpacityToTransmission(model) {

	model.traverse(c => {

		if (c.material) {

			const material = c.material;
			if (material.opacity < 0.65 && material.opacity > 0.2) {

				const newMaterial = new MeshPhysicalMaterial();
				for (const key in material) {

					if (key in material) {

						if (material[key] === null) {

							continue;

						}

						if (material[key].isTexture) {

							newMaterial[key] = material[key];

						} else if (material[key].copy && material[key].constructor === newMaterial[key].constructor) {

							newMaterial[key].copy(material[key]);

						} else if ((typeof material[key]) === 'number') {

							newMaterial[key] = material[key];

						}

					}

				}

				newMaterial.opacity = 1.0;
				newMaterial.transmission = 1.0;
				c.material = newMaterial;

			}

		}

	});

}

async function updateModel() {

	if (gui) {

		document.body.classList.remove('checkerboard');
		gui.destroy();
		gui = null;

	}

	let model;
	const manager = new LoadingManager();
	const modelInfo = models[params.model];

	loadingModel = true;
	renderer1.domElement.style.visibility = 'hidden';
	renderer2.domElement.style.visibility = 'hidden';
	samplesEl.innerText = '--';
	creditEl.innerText = '--';
	loadingEl.innerText = 'Even geduld...';
	loadingEl.style.visibility = 'visible';

	scene.traverse(c => {

		if (c.material) {

			const material = c.material;
			for (const key in material) {

				if (material[key] && material[key].isTexture) {

					material[key].dispose();

				}

			}

		}

	});

	if (sceneInfo) {

		scene.remove(sceneInfo.scene);

	}


	const onFinish = async () => {

		if (modelInfo.removeEmission) {

			model.traverse(c => {

				if (c.material) {

					c.material.emissiveMap = null;
					c.material.emissiveIntensity = 0;

				}

			});

		}

		if (modelInfo.opacityToTransmission) {

			convertOpacityToTransmission(model);

		}

		model.traverse(c => {

			if (c.material) {

				c.material.side = DoubleSide;

			}

		});

		if (modelInfo.postProcess) {

			modelInfo.postProcess(model);

		}

		// rotate model after so it doesn't affect the bounding sphere scale
		if (modelInfo.rotation) {

			model.rotation.set(...modelInfo.rotation);

		}

		// center the model
		const box = new Box3();
		box.setFromObject(model);
		model.position
			.addScaledVector(box.min, - 0.5)
			.addScaledVector(box.max, - 0.5);

		const sphere = new Sphere();
		box.getBoundingSphere(sphere);

		model.scale.setScalar(1 / sphere.radius);
		model.position.multiplyScalar(1 / sphere.radius);

		box.setFromObject(model);

		model.updateMatrixWorld();


		group = new Group();
		group.add(model);

		const reducer = new MaterialReducer();
		reducer.process(group);

		const generator = new PathTracingSceneWorker();
		const result = await generator.generate(group, {
			onProgress: v => {

				const percent = Math.floor(100 * v);
				loadingEl.innerText = `Building BVH : ${percent}%`;

			}
		});

		sceneInfo = result;
		scene.add(sceneInfo.scene);

		const { bvh, textures, materials, lights } = result;
		const geometry = bvh.geometry;

		const material1 = ptRenderer1.material;
		material1.bvh.updateFrom(bvh);
		material1.normalAttribute.updateFrom(geometry.attributes.normal);
		material1.tangentAttribute.updateFrom(geometry.attributes.tangent);
		material1.uvAttribute.updateFrom(geometry.attributes.uv);
		material1.materialIndexAttribute.updateFrom(geometry.attributes.materialIndex);
		material1.textures.setTextures(renderer1, 2048, 2048, textures);
		material1.materials.updateFrom(materials, textures);

		// update the lights
		material1.lights.updateFrom(lights);

		const material2 = ptRenderer2.material;

		material2.bvh.updateFrom(bvh);
		material2.normalAttribute.updateFrom(geometry.attributes.normal);
		material2.tangentAttribute.updateFrom(geometry.attributes.tangent);
		material2.uvAttribute.updateFrom(geometry.attributes.uv);
		material2.materialIndexAttribute.updateFrom(geometry.attributes.materialIndex);
		material2.textures.setTextures(renderer2, 2048, 2048, textures);
		material2.materials.updateFrom(materials, textures);

		material2.lights.updateFrom(lights);


		generator.dispose();

		loadingEl.style.visibility = 'hidden';

		creditEl.innerHTML = modelInfo.credit || '';
		creditEl.style.visibility = modelInfo.credit ? 'visible' : 'hidden';
		buildGui();

		loadingModel = false;
		renderer1.domElement.style.visibility = 'visible';
		renderer2.domElement.style.visibility = 'visible';

		ptRenderer1.reset();
		ptRenderer2.reset();

	};

	const url = modelInfo.url;
	if (/(gltf|glb)$/i.test(url)) {

		manager.onLoad = onFinish;
		new GLTFLoader(manager)
			.setMeshoptDecoder(MeshoptDecoder)
			.load(
				url,
				gltf => {

					model = gltf.scene;

				},
				progress => {

					if (progress.total !== 0 && progress.total >= progress.loaded) {

						const percent = Math.floor(100 * progress.loaded / progress.total);
						loadingEl.innerText = `Loading : ${percent}%`;

					}

				},
			);

	} else if (/mpd$/i.test(url)) {

		manager.onProgress = (url, loaded, total) => {

			const percent = Math.floor(100 * loaded / total);
			loadingEl.innerText = `Loading : ${percent}%`;

		};

		const loader = new LDrawLoader(manager);
		await loader.preloadMaterials('https://raw.githubusercontent.com/gkjohnson/ldraw-parts-library/master/colors/ldcfgalt.ldr');
		loader
			.setPartsLibraryPath('https://raw.githubusercontent.com/gkjohnson/ldraw-parts-library/master/complete/ldraw/')
			.load(
				url,
				result => {

					model = LDrawUtils.mergeObject(result);
					model.rotation.set(Math.PI, 0, 0);
					model.traverse(c => {

						if (c.isLineSegments) {

							c.visible = false;

						}

						if (c.isMesh) {

							c.material.roughness *= 0.01;

						}

					});
					onFinish();

				},
			);

	}

}
