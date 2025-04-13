import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'
// import { CSS2DRenderer} from "three/examples/jsm/renderers/CSS2DRenderer"
import { Earcut } from '../3dUtils/earcut'
import { SunCalc } from '../3dUtils/suncalc'

export default class Sun {
  constructor(options) {
    const { element, time, date, history, canvasWidth, canvasHeight,
      windowData } = options
    // this._isDev = dev && isDev // 在开发环境显示辅助线
    this._element = element // canvas 元素
    this._history = history
    this._windowData = windowData
    this._time = time
    this._date = date
    this._canvasWidth = canvasWidth
    this._canvasHeight = canvasHeight

    this.lon = 0;
    this.lat = 0;
  }

  init() {

    this._initRender()
    this._initScene()
    this._initCamera()
    this._initLight()
    this._initControl()
    this._addBasePlane()
    this._addSkyBox()
    window.onresize = () => {
      this._onWindowResize()
    }
    this._render()
    // this.lon = this._history.destLng;
    // this.lat = this._history.destLat;
    this.createBuildings(this._history);
    // this._rotate()
  }

  _render() {
    this._renderer.render(this._scene, this._camera)
    // this._labelRenderer.render(this._scene, this._camera)
    this._control.update()
    this._stats && this._stats.update()
    this._directionalLightHelper && this._directionalLightHelper.update()
    //根据当前的位置计算与z轴负方向的夹角，即为正北方方向
    var direction = new THREE.Vector3(-this._camera.position.x, 0, -this._camera.position.z).normalize()
    // 弧度值
    var theta = Math.atan2(-direction.x, -direction.z)
    this._onRotate && this._onRotate(theta)
    requestAnimationFrame(() => {
      this._render()
    })
  }

  _initRender() {
    let renderer = new THREE.WebGLRenderer({
      canvas: this._element,
      antialias: true, // 抗锯齿
      // logarithmicDepthBuffer: true, // 是否使用对数深度缓存
      alpha: true // 透明度
    })
    renderer.setSize(this._canvasWidth, this._canvasHeight)
    renderer.setPixelRatio(window.devicePixelRatio)
    renderer.setClearColor(0xb9d3ff, 1)
    renderer.shadowMap.enabled = true
    // renderer.shadowMap.type = THREE.PCFSoftShadowMap
    // document.body.appendChild(renderer.domElement)
    this._renderer = renderer
    // CSS2DRenderer
    // let labelRenderer = new CSS2DRenderer()
    // labelRenderer.setSize(this._canvasWidth, this._canvasHeight)
    // labelRenderer.domElement.style.position = 'absolute'
    // labelRenderer.domElement.style.top = '0'
    // labelRenderer.domElement.style.pointerEvents = 'none'
    // document.body.appendChild(labelRenderer.domElement)
    // this._labelRenderer = labelRenderer
  }

  _initScene() {
    let scene = new THREE.Scene()
    scene.background = new THREE.Color(0x222222)
    this._scene = scene
  }

  _initCamera() {
    let camera = new THREE.PerspectiveCamera(90, this._canvasWidth / this._canvasHeight, 0.001, 50000);
    // camera.position.set(150, 50, 50);
    this._camera = camera
  }

  _initLight() {
    // 环境光
    let ambientLight = new THREE.AmbientLight(0x888888, 0.8)
    // 平行光
    let sunDirection = new THREE.Vector3(0, 0, 0);
    //初始化太阳光
    let directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
    directionalLight.shadow.camera.near = 0.5
    directionalLight.shadow.camera.far = 5000
    directionalLight.shadow.camera.left = -120
    directionalLight.shadow.camera.right = 120
    directionalLight.shadow.camera.top = 120
    directionalLight.shadow.camera.bottom = -120
    directionalLight.shadow.mapSize.set(4096, 4096)
    directionalLight.castShadow = true
    directionalLight.position.copy(sunDirection);

    this._scene.add(ambientLight)
    this._scene.add(directionalLight)
    this._ambientLight = ambientLight
    this._directionalLight = directionalLight
  }

  _initControl() {
    const control = new OrbitControls(this._camera, this._renderer.domElement)
    control.enableDamping = true
    control.enableZoom = false
    control.enablePan = false
    control.enableRotate = false
    control.autoRotate = false
    control.autoRotateSpeed = 0.5
    control.minPolarAngle = 0
    control.maxPolarAngle = Math.PI / 2 - 0.1
    control.minDistance = 1
    control.maxDistance = 10000
    // control.minZoom = 0.1
    // control.maxZoom = 100
    this._control = control
  }

  // 天空盒
  _addSkyBox() {
    this._scene.background = new THREE.CubeTextureLoader()
      .setPath('/images/')
      .load([
        'center.png',
        'center.png',
        'top.png',
        'down.png',
        'center.png',
        'center.png'
      ])
  }

  // 地平面
  _addBasePlane() {
    const planeGeometry = new THREE.PlaneGeometry(1024, 1024)
    // const groundTexture = new THREE.TextureLoader().load(this._baseMap)
    const planeMaterial = new THREE.MeshLambertMaterial({
      color: 0xffffff,
      emissive: 0xffffff, // 可选：设置自发光颜色，让材质在没有光照时也能有一定的亮度  
      emissiveIntensity: 0.3 // 可选：设置自发光的强度  
    })
    const planeMesh = new THREE.Mesh(planeGeometry, planeMaterial)
    planeMesh.name = '地图平面'
    planeMesh.rotateX(-Math.PI / 2)
    planeMesh.receiveShadow = true
    planeMesh.castShadow = true
    planeMesh.frustumCulled = false;

    this._scene.add(planeMesh)
  }

  _onWindowResize() {
    this._camera.aspect = this._canvasWidth / this._canvasHeight
    this._camera.updateProjectionMatrix()
    this._renderer.setSize(this._canvasWidth, this._canvasHeight)
    // this._labelRenderer.setSize(this._canvasWidth, this._canvasHeight)
  }

  destroy() {
    console.log('destroy')
    if (this._scene) {
      let children = this._scene.children
      children.forEach(item => {
        if (item.type === 'Group') {
          this._removeGroup(item)
        } else if (item.type === 'Mesh') {
          this._removeMesh(item)
        } else if (item instanceof THREE.Light) {
          this._scene.remove(item)
        }
      })
    }
    this._scene.dispose()
    this._renderer.dispose()
    this._scene = null
    this._renderer = null
    // this._labelRenderer = null
    this._camera = null
    this._control = null
    this._ambientLight = null
    this._directionalLight = null
  }

  _removeGroup(group) {
    if (group.type === 'Group') {
      group.children.forEach(item => {
        if (item.type === 'Mesh') {
          this._removeMesh(item)
        }
      })
      this._scene.remove(group)
    }
  }

  _removeMesh(mesh) {
    if (mesh.type === 'Mesh') {
      mesh.geometry.dispose()
      if (Array.isArray(mesh.material)) {
        mesh.material.forEach(item => {
          item.map && item.map.dispose()
          item.dispose()
        })
      } else {
        mesh.material.dispose()
      }
      this._scene.remove(mesh)
    }
  }

  createBuildings(historyDetail) {

    let that = this;
    //添加观测楼
    var coordinates = this.transFormPositions(historyDetail.destPosition);
    //设置中心点
    this.lon = historyDetail.destLng;
    this.lat = historyDetail.destLat;

    var lightIndexArr = historyDetail.destEdgeEndpoints.split(",");
    var lightIndex = [parseInt(lightIndexArr[0]), parseInt(lightIndexArr[1])];

    // let destObserverFloor = historyDetail.destObserverFloor;

    var window = this.addWindow(this.transformCoordinate(coordinates, this.lon, this.lat), lightIndex, historyDetail.destObserverFloor, historyDetail.destFloorHeight);
    this._scene.add(window);

    var observeBuild = this.addBuildingContainsWindow(this.transformCoordinate(coordinates, this.lon, this.lat), lightIndex, historyDetail.destObserverFloor, historyDetail.destTotalFloor, historyDetail.destFloorHeight);
    this._scene.add(observeBuild);

    //添加遮挡楼
    if (historyDetail.barrierReqList && historyDetail.barrierReqList.length > 0) {
      historyDetail.barrierReqList.forEach(function (item) {
        var coordinates = that.transFormPositions(item.positionList);
        var barrierBuild = that.addBuilding(that.transformCoordinate(coordinates), item.totalFloor, item.floorHeight);
        that._scene.add(barrierBuild);
      });
    }

  }

  transFormPositions(destPositions) {
    let coordinates = destPositions.map(destPosition => {
      let newRing = [];
      newRing.push(destPosition.lng);
      newRing.push(destPosition.lat);
      return newRing;
    })
    return coordinates;
  }

  transformCoordinate(coordinates) {
    const center = this.lonlat2WebMercator(this.lon, this.lat);

    // web 墨卡托投影有变形
    const p = Math.cos(this.degreesToRadians(this.lat));
    let newCoordinates = coordinates.map(coordinate => {
      let newRing = [];
      const newCoordinate = this.lonlat2WebMercator(coordinate[0], coordinate[1]);

      const x = Math.round((newCoordinate[0] - center[0]) * p * 100) / 100;
      const y = Math.round((newCoordinate[1] - center[1]) * p * 100) / 100;
      newRing.push(x);
      newRing.push(y);
      return newRing;
    })
    return newCoordinates;
  }

  lonlat2WebMercator(lon, lat) {
    let xy = []
    let x = (lon * 20037508.34) / 180
    let y = Math.log(Math.tan(((90 + lat) * Math.PI) / 360)) / (Math.PI / 180)
    y = (y * 20037508.34) / 180
    xy[0] = x
    xy[1] = y
    return xy
  }

  addWindow(points, lightIndex, floorIndex, floorHeight) {
    points = points.map(point => {
      return [point[0], 0, -point[1]]
    })
    const group = new THREE.Group();

    var vertices = [];
    var faces = [];

    var lightFacePoint1 = new THREE.Vector3(points[lightIndex[0]][0], (floorIndex - 1) * floorHeight, points[lightIndex[0]][2]);
    var lightFacePoint2 = new THREE.Vector3(points[lightIndex[1]][0], (floorIndex - 1) * floorHeight, points[lightIndex[1]][2]);

    var lightFacePoint3 = new THREE.Vector3();
    lightFacePoint3.copy(lightFacePoint2);
    lightFacePoint3.y = (floorIndex) * floorHeight;
    var lightFacePoint4 = new THREE.Vector3();
    lightFacePoint4.copy(lightFacePoint1);
    lightFacePoint4.y = (floorIndex) * floorHeight;

    //计算窗户坐标
    var midPoint = this.calculateMidPoint(lightFacePoint1, lightFacePoint2);
    midPoint.y = midPoint.y + parseFloat(this._windowData.distanceToGround);
    var lightFacePoint5 = this.calculatePointCInLineAB(midPoint, lightFacePoint1, parseFloat(this._windowData.windowWidth) / 2);
    var lightFacePoint6 = this.calculatePointCInLineAB(midPoint, lightFacePoint2, parseFloat(this._windowData.windowWidth) / 2);

    var lightFacePoint7 = new THREE.Vector3();
    lightFacePoint7.copy(lightFacePoint6);
    lightFacePoint7.y = lightFacePoint7.y + parseFloat(this._windowData.windowHeight);
    var lightFacePoint8 = new THREE.Vector3();
    lightFacePoint8.copy(lightFacePoint5);
    lightFacePoint8.y = lightFacePoint8.y + parseFloat(this._windowData.windowHeight);

    vertices.push(lightFacePoint1);
    vertices.push(lightFacePoint2);
    vertices.push(lightFacePoint3);
    vertices.push(lightFacePoint4);
    vertices.push(lightFacePoint5);
    vertices.push(lightFacePoint6);
    vertices.push(lightFacePoint7);
    vertices.push(lightFacePoint8);

    faces.push(new THREE.Face3(0, 1, 5));
    faces.push(new THREE.Face3(0, 5, 4));
    faces.push(new THREE.Face3(0, 4, 3));
    faces.push(new THREE.Face3(4, 7, 3));
    faces.push(new THREE.Face3(7, 2, 3));
    faces.push(new THREE.Face3(7, 6, 2));
    faces.push(new THREE.Face3(1, 2, 6));
    faces.push(new THREE.Face3(1, 6, 5));

    var geometry = new THREE.Geometry()
    geometry.vertices = vertices
    geometry.faces = faces
    geometry.computeFaceNormals() //自动计算法向量
    
    const materialArr = new THREE.MeshLambertMaterial({
      side: THREE.FrontSide,
      color: 0xFCF8F5,
      emissive: 0xFCF8F5, // 可选：设置自发光颜色，让材质在没有光照时也能有一定的亮度  
      emissiveIntensity: 0.5, // 可选：设置自发光的强度  ,
    })

    const mesh = new THREE.Mesh(geometry, materialArr)
    mesh.castShadow = true
    mesh.receiveShadow = true
    group.add(mesh);

    const edgeGeometry = new THREE.EdgesGeometry(geometry, 1);
    const edgeMaterial = new THREE.LineBasicMaterial({
      color: 0x000000,
      linewidth:0.5,
      depthTest: true,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: 3,
    });
    const edgeLines = new THREE.LineSegments(edgeGeometry, edgeMaterial);
    edgeLines.renderOrder = 1;
    group.add(edgeLines)

    //添加窗户
    let verticesWindow = []
    let facesWindow = []
    verticesWindow.push(lightFacePoint5)
    verticesWindow.push(lightFacePoint6)
    verticesWindow.push(lightFacePoint7)
    verticesWindow.push(lightFacePoint8)

    facesWindow.push(new THREE.Face3(0, 1, 2))
    facesWindow.push(new THREE.Face3(2, 3, 0))
    var geometryWindow = new THREE.Geometry()
    geometryWindow.vertices = verticesWindow
    geometryWindow.faces = facesWindow
    geometryWindow.computeFaceNormals() //自动计算法向量
    const materialWindow = new THREE.MeshBasicMaterial({
      side: THREE.FrontSide,
      transparent: true,
      opacity: 0.3,
      color: 0xC6FBFF,
      emissive: 0xC6FBFF, // 可选：设置自发光颜色，让材质在没有光照时也能有一定的亮度  
      emissiveIntensity: 0.6, // 可选：设置自发光的强度  ,
    })

    const meshWindow = new THREE.Mesh(geometryWindow, materialWindow)
    meshWindow.castShadow = false
    meshWindow.receiveShadow = false
    group.add(meshWindow);

    //添加房屋墙壁
    var faceMidPoint = this.calculateMidPoint(lightFacePoint1, lightFacePoint2);
    var verticesA = [];
    var verticesB = [];
    var houseFaceAPoint1 = this.calculatePointCInLineAB(faceMidPoint, lightFacePoint1, parseFloat(this._windowData.windowWidth) / 2 + parseFloat(this._windowData.distanceToEastWall));
    var houseFaceBPoint1 = this.calculatePointCInLineAB(faceMidPoint, lightFacePoint2, parseFloat(this._windowData.windowWidth) / 2 + parseFloat(this._windowData.distanceToWestWall));
    var backLightPoints = this.calculateBackLightFace(houseFaceAPoint1, houseFaceBPoint1, 5, points);

    var houseFaceAPoint2 = backLightPoints[1];
    var houseFaceBPoint2 = backLightPoints[0];

    var houseFaceAPoint3 = new THREE.Vector3();
    houseFaceAPoint3.copy(houseFaceAPoint2);
    houseFaceAPoint3.y = houseFaceAPoint3.y + floorHeight * 0.98;
    var houseFaceBPoint3 = new THREE.Vector3();
    houseFaceBPoint3.copy(houseFaceBPoint2);
    houseFaceBPoint3.y = houseFaceBPoint3.y + floorHeight * 0.98;

    var houseFaceAPoint4 = new THREE.Vector3();
    houseFaceAPoint4.copy(houseFaceAPoint1);
    houseFaceAPoint4.y = houseFaceAPoint4.y + floorHeight * 0.98;
    var houseFaceBPoint4 = new THREE.Vector3();
    houseFaceBPoint4.copy(houseFaceBPoint1);
    houseFaceBPoint4.y = houseFaceBPoint4.y + floorHeight * 0.98;

    verticesA.push(houseFaceAPoint1);
    verticesA.push(houseFaceAPoint2);
    verticesA.push(houseFaceAPoint3);
    verticesA.push(houseFaceAPoint4);
    verticesB.push(houseFaceBPoint1);
    verticesB.push(houseFaceBPoint2);
    verticesB.push(houseFaceBPoint3);
    verticesB.push(houseFaceBPoint4);

    var facesA = [];
    var facesB = [];
    facesA.push(new THREE.Face3(0, 1, 2));
    facesA.push(new THREE.Face3(0, 2, 3));

    facesB.push(new THREE.Face3(0, 3, 2));
    facesB.push(new THREE.Face3(0, 2, 1));

    var geometryA = new THREE.Geometry();
    geometryA.vertices = verticesA;
    geometryA.faces = facesA;
    geometryA.computeFaceNormals();
    var geometryB = new THREE.Geometry();
    geometryB.vertices = verticesB;
    geometryB.faces = facesB;
    geometryB.computeFaceNormals();

    const materialArr2 = new THREE.MeshLambertMaterial({
      color: 0xFCF8F5,
      side: THREE.BackSide,
      emissive: 0xFCF8F5, // 可选：设置自发光颜色，让材质在没有光照时也能有一定的亮度  
      emissiveIntensity: 0.5, // 可选：设置自发光的强度  ,
    })

    const meshA = new THREE.Mesh(geometryA, materialArr2)
    meshA.castShadow = true
    meshA.receiveShadow = true
    group.add(meshA);
    const meshB = new THREE.Mesh(geometryB, materialArr2)
    meshB.castShadow = true
    meshB.receiveShadow = true
    group.add(meshB);

    const edgeGeometryA = new THREE.EdgesGeometry(geometryA, 1);
    const edgeMaterialA = new THREE.LineBasicMaterial({
      color: 0x000000,
      linewidth:0.5,
      depthTest: true,
      polygonOffset: true,
      polygonOffsetFactor: 1,
      polygonOffsetUnits: 3,
    });

    const edgeLinesA = new THREE.LineSegments(edgeGeometryA, edgeMaterialA);
    edgeLinesA.renderOrder = 1;
    group.add(edgeLinesA)

    const edgeGeometryB = new THREE.EdgesGeometry(geometryB, 1);
    const edgeMaterialB = new THREE.LineBasicMaterial({
      color: 0x000000,
      linewidth:0.5,
      depthTest: true,
      polygonOffset: true,
      polygonOffsetFactor: 1,
      polygonOffsetUnits: 3,
    });

    const edgeLinesB = new THREE.LineSegments(edgeGeometryB, edgeMaterialB);
    edgeLinesB.renderOrder = 1;
    group.add(edgeLinesB)

    //设置相机位置
    var cameraBackLightPoints = this.calculateBackLightFace(lightFacePoint1, lightFacePoint2, 5, points);
    var cameraPoint = this.calculateMidPoint(cameraBackLightPoints[0], cameraBackLightPoints[1]);
    cameraPoint.y = (floorIndex - 1) * floorHeight + floorHeight * 0.5;

    this._camera.position.set(cameraPoint.x, cameraPoint.y, cameraPoint.z);

    var cameraLookAt = this.calculateMidPoint(lightFacePoint1, lightFacePoint2);
    cameraLookAt.y = (floorIndex - 1) * floorHeight;

    this._camera.lookAt(cameraLookAt);
    this._control.target = new THREE.Vector3(cameraLookAt.x, cameraLookAt.y, cameraLookAt.z);

    return group;
  }

  addBuilding(points, totalFloor, floorHeight) {
    points = points.map(point => {
      return [point[0], 0, -point[1]]
    })
    const group = new THREE.Group()
    for (let i = 0; i < totalFloor; i++) {
      group.add(this.createShelterBuildingFloor(points, floorHeight, i,))
    }
    return group;
  }

  createShelterBuildingFloor(points, floorHeight, index) {
    const geometry = this.getGeometry(points, floorHeight * index, floorHeight)
    const materialArr = [
      // 侧面
      new THREE.MeshLambertMaterial({
        color: 0xF8F8F8,
        side: THREE.BackSide,
        emissive: 0xF8F8F8,
        emissiveIntensity: 0.5,
        depthTest: true,
        polygonOffset: true,
        polygonOffsetFactor: 1,
        polygonOffsetUnits: 1,
      }),
      // 顶部
      new THREE.MeshLambertMaterial({
        color: 0xF8F8F8,
        side: THREE.BackSide,
        emissive: 0xF8F8F8,
        emissiveIntensity: 0.6,
        depthTest: true,
        polygonOffset: true,
        polygonOffsetFactor: 1,
        polygonOffsetUnits: 1,
      })
    ]
    const mesh = new THREE.Mesh(geometry, materialArr)
    mesh.index = index
    mesh.castShadow = true
    mesh.receiveShadow = true

    // 创建边缘几何体
    const edgeGeometry = new THREE.EdgesGeometry(geometry, 1);
    const edgeMaterial = new THREE.LineBasicMaterial({
      color: 0xA5A5A5,
      depthTest: true,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: 3,
    });

    const edgeLines = new THREE.LineSegments(edgeGeometry, edgeMaterial);
    edgeLines.renderOrder = 1;

    const buildGroup = new THREE.Group()
    buildGroup.add(mesh)
    buildGroup.add(edgeLines)
    return buildGroup
  }

  addBuildingForObserve(points, totalFloor, floorHeight, observeFloor) {
    points = points.map(point => {
      return [point[0], 0, -point[1]]
    })
    const group = new THREE.Group()
    for (let i = 0; i < totalFloor; i++) {
      if (i == observeFloor - 1) {
        group.add(this.createBuildingFloorForObserve(points, floorHeight, i))
      } else {
        group.add(this.createBuildingFloor(points, floorHeight, i,))
      }
    }
    return group;
  }

  addBuildingContainsWindow(points, lightPointsIndex, observeFloor, totalFloor, floorHeight) {
    points = points.map(point => {
      return [point[0], 0, -point[1]]
    })
    const group = new THREE.Group()
    for (let i = 0; i < totalFloor; i++) {
      if (i == observeFloor - 1) {
        group.add(this.createBuildingFloorContainsWindow(points, lightPointsIndex, floorHeight, i))
      }
      else {
        group.add(this.createBuildingFloor(points, floorHeight, i))
      }
    }
    return group;
  }

  createBuildingFloor(points, floorHeight, index) {
    const geometry = this.getGeometry(points, floorHeight * index, floorHeight)
    let colorindex = index % 2;
    let color2 = 0xffffff
    if (colorindex == 0) { color2 = 0xffffff }
    else { color2 = 0xefefef }
    const materialArr = [
      // 侧面
      new THREE.MeshLambertMaterial({
        color: color2,
        side: THREE.BackSide
      }),
      // 顶部
      new THREE.MeshLambertMaterial({
        color: 0xffffff,
        side: THREE.BackSide
      })
    ]
    const mesh = new THREE.Mesh(geometry, materialArr)
    mesh.index = index
    mesh.castShadow = true
    mesh.receiveShadow = true
    return mesh
  }

  createBuildingFloorForObserve(points, floorHeight, index) {
    const geometry = this.getGeometry(points, floorHeight * index, floorHeight)
    const materialArr = [
      // 侧面
      new THREE.MeshLambertMaterial({
        color: 0xFF0000,
        side: THREE.BackSide,
        emissive: 0xFF0000, // 可选：设置自发光颜色，让材质在没有光照时也能有一定的亮度  
        emissiveIntensity: 0.3 // 可选：设置自发光的强度  
      }),
      // 顶部
      new THREE.MeshLambertMaterial({
        color: 0xffffff,
        side: THREE.BackSide
      }),
    ]
    const mesh = new THREE.Mesh(geometry, materialArr)
    mesh.index = index
    mesh.castShadow = true
    mesh.receiveShadow = true
    return mesh
  }

  createBuildingFloorContainsWindow(points, lightPointsIndex, floorHeight, index) {
    const geometry = this.getGeometryContainsWindow(points, lightPointsIndex, floorHeight * index, floorHeight)
    const materialArr = [
      // 侧面
      new THREE.MeshLambertMaterial({
        color: 0xF8F8F8,
        side: THREE.DoubleSide
      }),
      // 顶部
      new THREE.MeshLambertMaterial({
        side: THREE.FrontSide,
        color: 0xFCF8F5,
        emissive: 0xFCF8F5, // 可选：设置自发光颜色，让材质在没有光照时也能有一定的亮度  
        emissiveIntensity: 0.5, // 可选：设置自发光的强度  ,
      })
    ]
    const mesh = new THREE.Mesh(geometry, materialArr)
    mesh.index = index
    mesh.castShadow = true
    mesh.receiveShadow = true
    return mesh
  }

  // 传入一个坐标串和高度，返回一个 Geometry
  getGeometry(points, baseHeight, floorHeight) {
    var topPoints = []
    let basePoints = JSON.parse(JSON.stringify(points))

    for (let i = 0; i < basePoints.length; i++) {
      basePoints[i][1] = baseHeight
      topPoints.push([basePoints[i][0], baseHeight + floorHeight, basePoints[i][2]])
    }
    var totalPoints = basePoints.concat(topPoints)
    var vertices = []
    for (let i = 0; i < totalPoints.length; i++) {
      vertices.push(
        new THREE.Vector3(totalPoints[i][0], totalPoints[i][1], totalPoints[i][2])
      )
    }
    var length = points.length
    var faces = []
    //侧面生成三角形
    for (let j = 0; j < length; j++) {
      if (j != length - 1) {
        faces.push(new THREE.Face3(j, j + 1, length + j + 1))
        faces.push(new THREE.Face3(length + j + 1, length + j, j))
      } else {
        faces.push(new THREE.Face3(j, 0, length))
        faces.push(new THREE.Face3(length, length + j, j))
      }
    }
    var data = []
    for (let i = 0; i < length; i++) {
      data.push(points[i][0], points[i][2])
    }
    var triangles = Earcut.triangulate(data);
    if (triangles && triangles.length != 0) {
      for (let i = 0; i < triangles.length; i++) {
        var tlength = triangles.length
        if (i % 3 == 0 && i < tlength - 2) {
          //底部的三角面
          let face1 = new THREE.Face3(
            triangles[i],
            triangles[i + 1],
            triangles[i + 2]
          )
          //顶部的三角面
          let face2 = new THREE.Face3(
            triangles[i] + length,
            triangles[i + 1] + length,
            triangles[i + 2] + length
          )
          //纹理编号
          face1.materialIndex = 1
          face2.materialIndex = 1
          faces.push(face1)
          faces.push(face2)
        }
      }
    }
    var geometry = new THREE.Geometry()
    geometry.vertices = vertices
    geometry.faces = faces
    geometry.computeFaceNormals() //自动计算法向量

    return geometry
  }

  getGeometryContainsWindow(points, lightPointsIndex, baseHeight, floorHeight) {
    var topPoints = []
    let basePoints = JSON.parse(JSON.stringify(points))

    for (let i = 0; i < basePoints.length; i++) {
      basePoints[i][1] = baseHeight
      topPoints.push([basePoints[i][0], baseHeight + floorHeight, basePoints[i][2]])
    }
    var totalPoints = basePoints.concat(topPoints)
    var vertices = []
    for (let i = 0; i < totalPoints.length; i++) {
      vertices.push(
        new THREE.Vector3(totalPoints[i][0], totalPoints[i][1], totalPoints[i][2])
      )
    }
    var length = points.length
    var faces = []
    //侧面生成三角形
    for (let j = 0; j < length; j++) {
      if (j == lightPointsIndex[0]) {
        continue;
      }
      if (j != length - 1) {
        faces.push(new THREE.Face3(j, j + 1, length + j + 1))
        faces.push(new THREE.Face3(length + j + 1, length + j, j))
      } else {
        faces.push(new THREE.Face3(j, 0, length))
        faces.push(new THREE.Face3(length, length + j, j))
      }
    }
    var data = []
    for (let i = 0; i < length; i++) {
      data.push(points[i][0], points[i][2])
    }
    var triangles = Earcut.triangulate(data);
    if (triangles && triangles.length != 0) {
      for (let i = 0; i < triangles.length; i++) {
        var tlength = triangles.length
        if (i % 3 == 0 && i < tlength - 2) {
          //底部的三角面
          // let face1 = new THREE.Face3(
          //   triangles[i],
          //   triangles[i + 1],
          //   triangles[i + 2]
          // )
          //顶部的三角面
          let face2 = new THREE.Face3(
            triangles[i] + length,
            triangles[i + 1] + length,
            triangles[i + 2] + length
          )
          //纹理编号
          // face1.materialIndex = 1
          face2.materialIndex = 1
          // faces.push(face1)
          faces.push(face2)
        }
      }
    }
    var geometry = new THREE.Geometry()
    geometry.vertices = vertices
    geometry.faces = faces
    geometry.computeFaceNormals() //自动计算法向量

    return geometry
  }

  degreesToRadians(degrees) {
    return degrees * (Math.PI / 180);
  }

  // 计算多边形中心点坐标
  computeCenter(points) {
    points = points.map(point => {
      return [point[0], 0, -point[1]]
    })
    var count = points.length
    var x = 0
    var y = 0
    var f
    var j = count - 1
    var p1
    var p2
    for (var i = 0; i < count; j = i++) {
      p1 = points[i]
      p2 = points[j]
      f = p1[0] * p2[2] - p2[0] * p1[2]
      x += (p1[0] + p2[0]) * f
      y += (p1[2] + p2[2]) * f
    }
    f = this.computeArea(points) * 6
    return [x / f, y / f]
  }

  computeArea(points) {
    var area = 0
    var count = points.length
    var j = count - 1
    var p1
    var p2

    for (var i = 0; i < count; j = i++) {
      p1 = points[i]
      p2 = points[j]
      area += p1[0] * p2[2]
      area -= p1[2] * p2[0]
    }
    area /= 2

    return area
  }

  set time(value) {
    // 时间改变，只需要改变光照角度
    this._time = value
    this.rotateSun();
  }

  dateUpdate(date) {
    var suncalc = SunCalc.getTimes(date, this.lat, this.lon);
    var sunrise = suncalc.sunrise;
    var sunset = suncalc.sunset;

    let sun = [sunrise, sunset];
    this._date = date;

    return sun
  }

  rotateSun() {
    const date = new Date();

    date.setMonth(this._date.getMonth());
    date.setDate(this._date.getDate());

    let timeStr = this.timeFormat(this._time)
    let timeArr = timeStr.split(":");

    date.setHours(timeArr[0]);
    date.setMinutes(timeArr[1]);
    date.setSeconds(0);
    const sun = this.calculatePositionOfSun(date, this.lon, this.lat);

    let yAxis = new THREE.Vector3(0, 1, 0);
    let xAxis = new THREE.Vector3(1, 0, 0);
    let sunDirection = new THREE.Vector3(0, 0, 2000);

    //根据太阳高度角(x轴)和方位角(y轴)旋转太阳
    this.rotateAboutAxis(sunDirection, xAxis, this.degreesToRadians(-(sun[0])));
    this.rotateAboutAxis(sunDirection, yAxis, this.degreesToRadians(-(sun[1])));

    this._directionalLight.position.copy(sunDirection)
  }

  timeFormat(value, fmt = 'hh:mm') {
    let h = Math.floor(value)
    let m = Math.floor(value * 60 - h * 60)
    let s = Math.floor(value * 60 * 60 - h * 60 * 60 - m * 60)
    var o = {
      'h+': h,
      'm+': m,
      's+': s
    }
    for (var k in o) {
      if (new RegExp('(' + k + ')').test(fmt)) {
        fmt = fmt.replace(
          RegExp.$1,
          RegExp.$1.length == 1 ? o[k] : ('00' + o[k]).substr(('' + o[k]).length)
        )
      }
    }
    return fmt
  }

  calculatePositionOfSun(date, longitude, latitude) {
    const sunPosition = SunCalc.getPosition(date, latitude, longitude);
    // 太阳高度角（弧度转换为角度）
    const heightAngle = sunPosition.altitude * (180 / Math.PI);
    // 太阳方位角（弧度转换为角度，并将其调整到0-360范围内, 正南为0°，向西顺时针增加，正西为90°）单位度
    const azimuthAngle = (sunPosition.azimuth * (180 / Math.PI) + 360) % 360;
    return [heightAngle, azimuthAngle]
  }

  // 将物体绕着某一个轴旋转
  rotateAboutAxis(object, axis, angle) {
    const rotationMatrix = new THREE.Matrix4()
    rotationMatrix.makeRotationAxis(axis.normalize(), angle)
    const currentPos = new THREE.Vector4(
      object.x,
      object.y,
      object.z,
      1
    )
    const newPos = currentPos.applyMatrix4(rotationMatrix)
    object.x = newPos.x
    object.y = newPos.y
    object.z = newPos.z
  }

  calculateMidPoint(A, B) {
    var midpoint = new THREE.Vector3();
    midpoint.addVectors(A, B).multiplyScalar(0.5); // 先相加，然后乘以0.5
    return midpoint;
  }

  calculatePointCInLineAB(A, B, d) {
    const AB = new THREE.Vector3().subVectors(B, A).length();
    const k = d / AB;

    const C = new THREE.Vector3();
    C.copy(A);
    C.addScaledVector(new THREE.Vector3().subVectors(B, A), k);
    return C;
  }

  calculateBackLightFace(A, B, Length, polygon) {
    // 计算中点  
    var midpoint = this.calculateMidPoint(A, B);
    //根据采光面中点计算房间进深方向(先用进深为1判断，避免超出房子对判断造成影响)  
    var midpointVector = new THREE.Vector3().subVectors(A, midpoint);
    midpointVector.normalize();
    var perpendicularMid = new THREE.Vector3(-midpointVector.z, 0, midpointVector.x);
    perpendicularMid.normalize();
    var midPointLine = new THREE.Vector3().copy(perpendicularMid).multiplyScalar(1);
    // 计算点 C 的坐标  
    var midpointToAB = new THREE.Vector3().addVectors(midpoint, midPointLine);
    //二维图形坐标，用来判断点是否在多边形内,如果不在则换个方向
    var polygonPoints = polygon.map(point => {
      return [point[0], point[2]]
    })
    var midPonintC = [midpointToAB.x, midpointToAB.z];
    var isInPolygon = this.isPointInPolygon(midPonintC, polygonPoints);
    var lineCVector, perpendicularC, lineC, pointC, lineDVector, perpendicularD, lineD, pointD, points;

    if (isInPolygon) {
      lineCVector = new THREE.Vector3().subVectors(A, B);
      lineCVector.normalize();
      perpendicularC = new THREE.Vector3(-lineCVector.z, 0, lineCVector.x);
      perpendicularC.normalize();
      lineC = new THREE.Vector3().copy(perpendicularC).multiplyScalar(Length);
      pointC = new THREE.Vector3().addVectors(B, lineC);

      lineDVector = new THREE.Vector3().subVectors(B, A);
      lineDVector.normalize();
      perpendicularD = new THREE.Vector3(lineDVector.z, 0, -lineDVector.x);
      perpendicularD.normalize();
      lineD = new THREE.Vector3().copy(perpendicularD).multiplyScalar(Length);
      pointD = new THREE.Vector3().addVectors(A, lineD);

      points = [pointC, pointD];
      return points;
    }
    else {
      lineCVector = new THREE.Vector3().subVectors(A, B);
      lineCVector.normalize();
      perpendicularC = new THREE.Vector3(lineCVector.z, 0, -lineCVector.x);
      perpendicularC.normalize();
      lineC = new THREE.Vector3().copy(perpendicularC).multiplyScalar(Length);
      pointC = new THREE.Vector3().addVectors(B, lineC);

      lineDVector = new THREE.Vector3().subVectors(B, A);
      lineDVector.normalize();
      perpendicularD = new THREE.Vector3(-lineDVector.z, 0, lineDVector.x);
      perpendicularD.normalize();
      lineD = new THREE.Vector3().copy(perpendicularD).multiplyScalar(Length);
      pointD = new THREE.Vector3().addVectors(A, lineD);

      points = [pointC, pointD];
      return points;
    }
  }

  isPointInPolygon(point, polygon) {
    var x = point[0], y = point[1];
    var inside = false;
    var n = polygon.length;

    for (var i = 0, j = n - 1; i < n; j = i++) {
      var xi = polygon[i][0], yi = polygon[i][1];
      var xj = polygon[j][0], yj = polygon[j][1];

      var intersect = ((yi > y) != (yj > y)) &&
        (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
      if (intersect) {
        inside = !inside;
      }
    }
    return inside;
  }

}