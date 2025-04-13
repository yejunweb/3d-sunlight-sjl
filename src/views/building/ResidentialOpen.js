import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'
import { CSS2DRenderer, CSS2DObject } from "three/examples/jsm/renderers/CSS2DRenderer"
import { Earcut } from '../3dUtils/earcut'
import { SunCalc } from '../3dUtils/suncalc'

const loader = new THREE.FontLoader()
export default class SunOpen {
  constructor(options) {
    const { element, time, date, history, onRotate, onCancelBuildSelect, onChoseBuildNumber } = options
    // this._isDev = dev && isDev // 在开发环境显示辅助线
    this._element = element // canvas 元素
    this._history = history
    this._time = time;
    this._date = date;
    this._onRotate = onRotate
    this.onCancelBuildSelect = onCancelBuildSelect
    this.onChoseBuildNumber = onChoseBuildNumber
    // this._lon = utils.deg2rad(lon) // 经度弧度
    // this._lat = utils.deg2rad(lat) // 纬度弧度
    // this._date = date // 日期
    // this._time = time // 时间（数字）
    // this._baseMap = baseMap
    // this._R = 2000 // 太阳轨迹半径
    // this._floorHeight = 6 // 单层楼的高度
    // this._floorColors = [0xffffff, 0xefefef]
    this.lon = 0;
    this.lat = 0;
    this.center = new THREE.Vector3(0, 0, 0);
    this.buildingNumberMap = new Map();
    this.buildingPositionMap = new Map();
    this.inSingleMode = false;
    this.buildingGroup = [];
    this.originalPosition = null;
    this.selectBuildGroup = null;
    this.mouseDownPosition = new THREE.Vector2(), // 记录鼠标按下位置
      this.mouseUpPosition = new THREE.Vector2() // 记录鼠标松开位置
    this.southWallMeshMap = new Map();
    this.houseNumber = 1;
    this.unitNumber = 0;
    this.roomNumber = 0;
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
    this.lon = this._history.destLng;
    this.lat = this._history.destLat;
    this.createBuildings(this._history);
    // this._rotate()
  }

  _render() {
    this._renderer.render(this._scene, this._camera)
    this._labelRenderer.render(this._scene, this._camera)
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
    renderer.setSize(window.innerWidth, window.innerHeight)
    renderer.setPixelRatio(window.devicePixelRatio)
    renderer.setClearColor(0xb9d3ff, 1)
    renderer.shadowMap.enabled = true
    // renderer.shadowMap.type = THREE.PCFSoftShadowMap
    // document.body.appendChild(renderer.domElement)
    this._renderer = renderer
    // CSS2DRenderer
    let labelRenderer = new CSS2DRenderer()
    labelRenderer.setSize(window.innerWidth, window.innerHeight)
    labelRenderer.domElement.style.position = 'absolute'
    labelRenderer.domElement.style.top = '0'
    labelRenderer.domElement.style.pointerEvents = 'none'
    document.body.appendChild(labelRenderer.domElement)
    this._labelRenderer = labelRenderer
  }

  _initScene() {
    let scene = new THREE.Scene()
    scene.background = new THREE.Color(0x222222)
    this._scene = scene
  }

  _initCamera() {
    let camera = new THREE.PerspectiveCamera(
      45,
      window.innerWidth / window.innerHeight,
      5,
      5000
    )
    camera.position.set(0, 400, 400)
    camera.lookAt(this._scene.position)
    // camera.lookAt(this._scene.position)
    this._camera = camera
  }

  _initLight() {
    // 环境光
    let ambientLight = new THREE.AmbientLight(0x666666, 0.8)
    // 平行光
    let sunDirection = new THREE.Vector3(0, 0, 0);
    //初始化太阳光
    let directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
    directionalLight.shadow.camera.near = 0.5
    directionalLight.shadow.camera.far = 5000
    directionalLight.shadow.camera.left = -500
    directionalLight.shadow.camera.right = 500
    directionalLight.shadow.camera.top = 500
    directionalLight.shadow.camera.bottom = -500
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
    control.enableZoom = true
    control.enablePan = true
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
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.arc(0, 0, 1024, 0, Math.PI * 2, false); // 半径为1的圆
    const geometry = new THREE.ShapeGeometry(shape);
    // const planeGeometry = new THREE.PlaneGeometry(1024, 1024)
    // const groundTexture = new THREE.TextureLoader().load(this._baseMap)
    const planeMaterial = new THREE.MeshLambertMaterial({
      color: 0x9FB6E0,
      emissive: 0x9FB6E0, // 可选：设置自发光颜色，让材质在没有光照时也能有一定的亮度  
      emissiveIntensity: 0.3, // 可选：设置自发光的强度  ,
      depthTest: true,
      polygonOffset: true,
      polygonOffsetFactor: 1,
      polygonOffsetUnits: 1,
    })
    const planeMesh = new THREE.Mesh(geometry, planeMaterial)
    planeMesh.name = '地图平面'
    planeMesh.rotateX(-Math.PI / 2)
    planeMesh.receiveShadow = true
    planeMesh.castShadow = true
    this._scene.add(planeMesh)
  }

  _onWindowResize() {
    this._camera.aspect = window.innerWidth / window.innerHeight
    this._camera.updateProjectionMatrix()
    this._renderer.setSize(window.innerWidth, window.innerHeight)
    this._labelRenderer.setSize(window.innerWidth, window.innerHeight)
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
    this._labelRenderer = null
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

  addText(position, text, y, scene) {
    loader.load(
      '/fonts/gentilis_bold.typeface copy.json',
      function (font) {
        const geometry = new THREE.TextGeometry(text, {
          font: font,
          size: 10, // 字体大小
          height: 1, // 挤出文本的厚度
        })
        geometry.center() // 居中文本
        const materials = new THREE.MeshBasicMaterial({
          color: 0xff0000,
          transparent: true,
          opacity: 0.5,
        })
        const textMesh = new THREE.Mesh(geometry, materials)
        textMesh.position.copy(position)
        textMesh.position.y = y
        scene.add(textMesh)
        // // 可选：在渲染循环中保持文字面向摄像机
        // function animate() {
        //   requestAnimationFrame(animate)
        //   textMesh.lookAt(this._camera.position)
        // }
        // animate()
      }
    )
  }

  createBuildings(historyDetail) {
    // 初始化x和z的最小最大值
    let minX = Infinity, maxX = -Infinity;
    let minZ = Infinity, maxZ = -Infinity;
    //设置中心点(观测楼第一个点)
    this.lon = historyDetail.destLng;
    this.lat = historyDetail.destLat;

    this.originalPosition = this._camera.position.clone();

    //添加楼
    if (historyDetail.barrierReqList && historyDetail.barrierReqList.length > 0) {
      for (var index = 0; index < historyDetail.barrierReqList.length; index++) {
        var building = historyDetail.barrierReqList[index];
        let houseRoomList = building.houseList;
        let buildGroup = new THREE.Group()
        if (houseRoomList.length > 0) {
          for (var houseIndex = 0; houseIndex < houseRoomList.length; houseIndex++) {
            var houseRoom = houseRoomList[houseIndex];
            this.addBuildingByHouse(buildGroup, houseRoom, building);
          }
        } else {
          this.addBuildingByBuilding(buildGroup, building);
        }
        buildGroup.name = `Building-${building.buildingNumber}-${building.totalFloor}`;
        this._scene.add(buildGroup);
        let buildPoints = this.transformCoordinate(this.transFormPositions(building.positionList));
        const sum = [0, 0, 0];
        buildPoints.forEach(point => {
          sum[0] += point[0];
          sum[2] += -point[1];
        })
        this.buildingPositionMap.set(buildGroup, new THREE.Vector3(sum[0] / buildPoints.length, (building.totalFloor + 2) * building.floorHeight, sum[2] / buildPoints.length))
        const div2 = document.createElement('div');
        div2.innerHTML = `<div class="three-d-label">${building.buildingNumber}#</div>`
        const label2 = new CSS2DObject(div2);
        label2.position.set(sum[0] / buildPoints.length, (building.totalFloor + 2) * building.floorHeight, sum[2] / buildPoints.length);
        buildGroup.add(label2);
        this.buildingNumberMap.set(building.buildingNumber, buildGroup)
        this._scene.add(buildGroup);
        this.buildingGroup.push(buildGroup);
        const boundingBox = new THREE.Box3().setFromObject(buildGroup);
        if (boundingBox.min.x < minX) minX = boundingBox.min.x;
        if (boundingBox.max.x > maxX) maxX = boundingBox.max.x;

        // 更新z轴的最小最大值
        if (boundingBox.min.z < minZ) minZ = boundingBox.min.z;
        if (boundingBox.max.z > maxZ) maxZ = boundingBox.max.z;
      }
      if (this._history.roadList != null && this._history.roadList.length > 0) {
        this.createRoads(this._history.roadList)
      } else {
        this.createDefaultRoad(minX, maxX, minZ, maxZ)
      }
    }

    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const onMouseClick = (event) => {
      if (this.inSingleMode) {
        return;
      }
      let x, y;
      if (event.touches) {
        // 触摸事件
        x = event.touches[0].clientX;
        y = event.touches[0].clientY;
        console.log("触摸");
      } else {
        // 鼠标事件
        x = event.clientX;
        y = event.clientY;
        console.log("鼠标");
      }
      mouse.x = (x / window.innerWidth) * 2 - 1;
      mouse.y = -(y / window.innerHeight) * 2 + 1;

      raycaster.setFromCamera(mouse, this._camera);
      const intersects = raycaster.intersectObjects(this._scene.children, true);
      // console.log(intersects.length)
      if (intersects.length > 0) {
        const targetObject = intersects[0].object;
        // 查找该对象所属的 Group
        let selectedGroup = targetObject;
        while (selectedGroup && !(selectedGroup instanceof THREE.Group)) {
          selectedGroup = selectedGroup.parent;
        }
        // 如果找到 Group 并且是目标建筑物
        if (selectedGroup && selectedGroup.name.startsWith('Building')) {
          this.highlightBuilding(this.buildingGroup, selectedGroup);
        }
      }
    };

    const onMouseDown = (event) => {
      this.mouseDownPosition.set(event.clientX, event.clientY);
    }

    const onMouseUp = (event) => {
      this.mouseUpPosition.set(event.clientX, event.clientY);
      const deltaX = this.mouseUpPosition.x - this.mouseDownPosition.x;
      const deltaY = this.mouseUpPosition.y - this.mouseDownPosition.y;
      const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

      if (distance < 5) {
        // 距离很小，认为是点击事件
        onMouseClick(event);
      } else {
        // 距离较大，认为是拖拽事件
        return
      }
    }

    // window.addEventListener('click', onMouseClick);
    this._element.addEventListener('pointerdown', onMouseDown);
    this._element.addEventListener('pointerup', onMouseUp);
    // window.addEventListener('pointerdown', onMouseDown);
    // window.addEventListener('pointerup', onMouseUp);
  }

  southWallFormat(swallsEndpoints) {
    if (!swallsEndpoints) {
      return []
    }
    let southWallPoints = []
    var southWallArr = JSON.parse(swallsEndpoints);
    for (var index = 0; index < southWallArr.length; index++) {
      var southWall = southWallArr[index]
      southWallPoints.push(southWall.pid1)
    }
    return southWallPoints
  }

  createDefaultRoad(minX, maxX, minZ, maxZ) {
    // console.log(minX,maxX,minZ,maxZ)
    const group = new THREE.Group();
    const materialArr = new THREE.MeshLambertMaterial({
      color: 0xFFFFFF,
      side: THREE.BackSide,
      emissive: 0xFFFFFF, // 可选：设置自发光颜色，让材质在没有光照时也能有一定的亮度  
      emissiveIntensity: 0.4, // 可选：设置自发光的强度
      // depthTest:true,
      // polygonOffset: true,
      // polygonOffsetFactor: -1,
      // polygonOffsetUnits: 1,
    })
    var verticesA = [];
    var roadAPonit1 = new THREE.Vector3(minX - 30, 0.5, minZ - 60)
    var roadAPonit2 = new THREE.Vector3(minX - 10, 0.5, minZ - 60)
    var roadAPonit3 = new THREE.Vector3(minX - 10, 0.5, maxZ + 60)
    var roadAPonit4 = new THREE.Vector3(minX - 30, 0.5, maxZ + 60)
    verticesA.push(roadAPonit1);
    verticesA.push(roadAPonit2);
    verticesA.push(roadAPonit3);
    verticesA.push(roadAPonit4);
    var facesA = []
    facesA.push(new THREE.Face3(0, 1, 2));
    facesA.push(new THREE.Face3(0, 2, 3));
    var geometryA = new THREE.Geometry();
    geometryA.vertices = verticesA;
    geometryA.faces = facesA;
    geometryA.computeFaceNormals();
    const meshA = new THREE.Mesh(geometryA, materialArr)
    meshA.castShadow = true
    meshA.receiveShadow = true
    group.add(meshA);

    var verticesB = [];
    var roadBPonit1 = new THREE.Vector3(minX - 60, 0.5, minZ - 30)
    var roadBPonit2 = new THREE.Vector3(maxX + 60, 0.5, minZ - 30)
    var roadBPonit3 = new THREE.Vector3(maxX + 60, 0.5, minZ - 10)
    var roadBPonit4 = new THREE.Vector3(minX - 60, 0.5, minZ - 10)
    verticesB.push(roadBPonit1);
    verticesB.push(roadBPonit2);
    verticesB.push(roadBPonit3);
    verticesB.push(roadBPonit4);
    var facesB = []
    facesB.push(new THREE.Face3(0, 1, 2));
    facesB.push(new THREE.Face3(0, 2, 3));
    var geometryB = new THREE.Geometry();
    geometryB.vertices = verticesB;
    geometryB.faces = facesB;
    geometryB.computeFaceNormals();
    const roadMeshB = new THREE.Mesh(geometryB, materialArr)
    roadMeshB.castShadow = true
    roadMeshB.receiveShadow = true
    group.add(roadMeshB);

    var verticesC = [];
    var roadCPonit1 = new THREE.Vector3(maxX + 10, 0.5, minZ - 60)
    var roadCPonit2 = new THREE.Vector3(maxX + 30, 0.5, minZ - 60)
    var roadCPonit3 = new THREE.Vector3(maxX + 30, 0.5, maxZ + 60)
    var roadCPonit4 = new THREE.Vector3(maxX + 10, 0.5, maxZ + 60)
    verticesC.push(roadCPonit1);
    verticesC.push(roadCPonit2);
    verticesC.push(roadCPonit3);
    verticesC.push(roadCPonit4);
    var facesC = []
    facesC.push(new THREE.Face3(0, 1, 2));
    facesC.push(new THREE.Face3(0, 2, 3));
    var geometryC = new THREE.Geometry();
    geometryC.vertices = verticesC;
    geometryC.faces = facesC;
    geometryC.computeFaceNormals();
    const roadMeshC = new THREE.Mesh(geometryC, materialArr)
    roadMeshC.castShadow = true
    roadMeshC.receiveShadow = true
    group.add(roadMeshC);

    var verticesD = [];
    var roadDPonit1 = new THREE.Vector3(minX - 60, 0.5, maxZ + 10)
    var roadDPonit2 = new THREE.Vector3(maxX + 60, 0.5, maxZ + 10)
    var roadDPonit3 = new THREE.Vector3(maxX + 60, 0.5, maxZ + 30)
    var roadDPonit4 = new THREE.Vector3(minX - 60, 0.5, maxZ + 30)
    verticesD.push(roadDPonit1);
    verticesD.push(roadDPonit2);
    verticesD.push(roadDPonit3);
    verticesD.push(roadDPonit4);
    var facesD = []
    facesD.push(new THREE.Face3(0, 1, 2));
    facesD.push(new THREE.Face3(0, 2, 3));
    var geometryD = new THREE.Geometry();
    geometryD.vertices = verticesD;
    geometryD.faces = facesD;
    geometryD.computeFaceNormals();
    const roadMeshD = new THREE.Mesh(geometryD, materialArr)
    roadMeshD.castShadow = true
    roadMeshD.receiveShadow = true
    group.add(roadMeshD);


    //小区地面
    var verticesE = [];
    var communityPonit1 = new THREE.Vector3(minX - 10, 0.5, minZ - 10)
    var communityPonit2 = new THREE.Vector3(maxX + 10, 0.5, minZ - 10)
    var communityPonit3 = new THREE.Vector3(maxX + 10, 0.5, maxZ + 10)
    var communityPonit4 = new THREE.Vector3(minX - 10, 0.5, maxZ + 10)
    verticesE.push(communityPonit1)
    verticesE.push(communityPonit2)
    verticesE.push(communityPonit3)
    verticesE.push(communityPonit4)
    var facesE = []
    facesE.push(new THREE.Face3(0, 1, 2));
    facesE.push(new THREE.Face3(0, 2, 3));

    var geometryE = new THREE.Geometry();
    geometryE.vertices = verticesE;
    geometryE.faces = facesE;
    geometryE.computeFaceNormals();

    const materialArr2 = new THREE.MeshLambertMaterial({
      color: 0x8395B7,
      side: THREE.BackSide,
      emissive: 0x8395B7, // 可选：设置自发光颜色，让材质在没有光照时也能有一定的亮度  
      emissiveIntensity: 0.5, // 可选：设置自发光的强度  
      // depthTest:true,
      // polygonOffset: true,
      // polygonOffsetFactor: -1,
      // polygonOffsetUnits: 1,
    })

    const meshE = new THREE.Mesh(geometryE, materialArr2)
    meshE.castShadow = true
    meshE.receiveShadow = true
    group.add(meshE);

    this._scene.add(group)
  }

  createRoads(roadList) {
    let roadGroup = new THREE.Group()
    roadList.forEach(road => {
      let roadPoints = this.transformCoordinate(this.transFormPositions(road.geometryLoc))
      roadPoints = roadPoints.map(point => {
        return [point[0], 0.5, -point[1]]
      })
      let vertices = [];
      let faces = [];
      let data = [];
      for (let i = 0; i < roadPoints.length; i++) {
        vertices.push(
          new THREE.Vector3(roadPoints[i][0], roadPoints[i][1], roadPoints[i][2])
        )
        data.push(roadPoints[i][0], roadPoints[i][2])
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
            //纹理编号
            faces.push(face1)
          }
        }
      }
      var geometry = new THREE.Geometry()
      geometry.vertices = vertices
      geometry.faces = faces
      geometry.computeFaceNormals() //自动计算法向量
      let material = new THREE.MeshLambertMaterial({
        color: 0xFFFFFF,
        side: THREE.BackSide,
        emissive: 0xFFFFFF, // 可选：设置自发光颜色，让材质在没有光照时也能有一定的亮度  
        emissiveIntensity: 0.4, // 可选：设置自发光的强度
      })
      let mesh = new THREE.Mesh(geometry, material)
      roadGroup.add(mesh)
    })
    this._scene.add(roadGroup)
  }

  switchHighlightBuilding(number) {
    if (number === undefined) {
      this.resetHightBuilding(this.buildingGroup, this.selectBuildGroup)
    }
    else {
      var selectBuild = this.buildingNumberMap.get(number)
      if (selectBuild) {
        this.resetHightBuilding(this.buildingGroup, this.selectBuildGroup)
        this.highlightBuilding(this.buildingGroup, selectBuild)
      }
    }
  }

  highlightBuilding(buildingGroup, selectedBuilding) {
    let totalFloor = 0;
    var buildNameArr = selectedBuilding.name.split('-')
    if (buildNameArr.length > 0) {
      var buildNumber = buildNameArr[1]
      totalFloor = Number(buildNameArr[2])
      this.onChoseBuildNumber(buildNumber)
    }

    this.selectBuildGroup = selectedBuilding
    const buildingPosition = this.buildingPositionMap.get(selectedBuilding);
    const cameraPosition = new THREE.Vector3(buildingPosition.x, 0, buildingPosition.z);
    // 切换相机视角到该建筑物
    this._camera.position.set(cameraPosition.x, 0, cameraPosition.z + 250);
    this._camera.fov = 30; // 设置视角为 30 度（默认通常是 50 或 75）
    this._control.target.copy(cameraPosition);

    this.inSingleMode = true;
    let buildingNumber = selectedBuilding.name.split('-')[1]
    buildingGroup.forEach(group => {
      const isSelected = group === selectedBuilding;
      group.children.forEach(child => {
        if (child.material) {
          // 设置材质透明度
          child.material.transparent = true;
          child.material.opacity = isSelected ? 1 : 0;
        }
        if (!isSelected) {
          child.renderOrder = 1
        }
        else {
          child.renderOrder = 0
        }
        if (child.type === 'Object3D') {
          if (isSelected) {
            child.element.innerHTML = `
            <div class='three-d-label-container'>
              <div class='three-d-label'>${buildingNumber}#  |  共${totalFloor}层 </div>
              <div class='three-d-label-btn'>
                <img src="/images/quit.png" alt="">
              </div>
            </div>
            `
            child.element.style.pointerEvents = 'auto'
            child.element.addEventListener('click', () => {
              this.resetHightBuilding(this.buildingGroup, selectedBuilding);
            })
          }
          else {
            child.element.hidden = true
          }
        }
      });
    });
  }

  resetHightBuilding(buildingGroup, selectedBuilding) {
    this._camera.position.copy(this.originalPosition); // 恢复初始相机位置
    this._control.target.copy(this.center); // 恢复相机的目标点
    buildingGroup.forEach(group => {
      group.children.forEach(child => {
        if (child.material) {
          // 设置材质透明度
          child.material.transparent = false;
          child.material.opacity = 1; // 高亮选中，其他虚化
        }
        if (child.type === 'Object3D') {
          if (group === selectedBuilding) {
            let buildingNumber = group.name.split("-")[1]
            child.element.innerHTML = `<div class="three-d-label">${buildingNumber}#</div>`
          }
          child.element.hidden = false
        }
      });
    });
    this.inSingleMode = false;
    this.onCancelBuildSelect();
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

  addBuildingByHouse(buildGroup, houseRoom, building) {
    let totalFloor = building.totalFloor
    let floorHeight = building.floorHeight
    let points = this.transformCoordinate(this.transFormPositions(houseRoom.positionList));
    // console.log(points)
    points = points.map(point => {
      return [point[0], 0, -point[1]]
    })
    let southWallPoints = this.southWallFormat(houseRoom.swallsEndpoints)
    for (let i = 0; i < totalFloor; i++) {
      this.createBuildingFloorByHouse(buildGroup, points, southWallPoints, floorHeight, i)
      this.createSouthWall(buildGroup, building.buildingNumber, floorHeight, houseRoom, points, i);
    }
  }

  addBuildingByBuilding(buildGroup, building) {
    let totalFloor = building.totalFloor
    let floorHeight = building.floorHeight
    let points = this.transformCoordinate(this.transFormPositions(building.positionList));
    points = points.map(point => {
      return [point[0], 0, -point[1]]
    })
    for (let i = 0; i < totalFloor; i++) {
      this.createBuildingFloorByBuilding(buildGroup, points, floorHeight, i)
    }
  }

  createBuildingFloorByHouse(buildGroup, points, southWallPointsIndex, floorHeight, index) {
    const geometry = this.getGeometryWithoutSouthWall(points, southWallPointsIndex, floorHeight * index, floorHeight)
    const materialArr =
      new THREE.MeshLambertMaterial({
        // color: 0xB60707,
        color: 0xFED7BF,
        emissive: 0xFED7BF, // 可选：设置自发光颜色，让材质在没有光照时也能有一定的亮度  
        emissiveIntensity: 0.5,
        side: THREE.BackSide,
        depthTest: true,
        polygonOffset: true,
        polygonOffsetFactor: 1,
        polygonOffsetUnits: 1,
      })
    const mesh = new THREE.Mesh(geometry, materialArr)
    mesh.castShadow = true
    mesh.receiveShadow = true
    buildGroup.add(mesh)
    // 创建边缘几何体
    const edgeGeometry = new THREE.EdgesGeometry(geometry, 1);
    const edgeMaterial = new THREE.LineBasicMaterial({
      color: 0x8D7669,
      depthTest: true,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: 3,
    });

    const edgeLines = new THREE.LineSegments(edgeGeometry, edgeMaterial);
    edgeLines.renderOrder = 1;
    buildGroup.add(edgeLines)
  }

  createBuildingFloorByBuilding(buildGroup, points, floorHeight, index) {
    const geometry = this.getGeometry(points, floorHeight * index, floorHeight)
    const materialArr =
      new THREE.MeshLambertMaterial({
        // color: 0xB60707,
        color: 0xffffff,
        emissive: 0xffffff, // 可选：设置自发光颜色，让材质在没有光照时也能有一定的亮度  
        emissiveIntensity: 0.5,
        side: THREE.BackSide,
        depthTest: true,
        polygonOffset: true,
        polygonOffsetFactor: 1,
        polygonOffsetUnits: 1,
      })
    const mesh = new THREE.Mesh(geometry, materialArr)
    mesh.castShadow = true
    mesh.receiveShadow = true
    buildGroup.add(mesh)

    // 创建边缘几何体
    const edgeGeometry = new THREE.EdgesGeometry(geometry, 1);
    const edgeMaterial = new THREE.LineBasicMaterial({
      color: 0x8D7669,
      depthTest: true,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: 3,
    });

    const edgeLines = new THREE.LineSegments(edgeGeometry, edgeMaterial);
    edgeLines.renderOrder = 1;
    buildGroup.add(edgeLines)
  }

  createSouthWall(buildGroup, buildingNumber, floorHeight, houseRoom, points, index) {
    if (!houseRoom.swallsEndpoints) {
      return
    }
    // console.log(houseRoom)

    var southWallArr = JSON.parse(houseRoom.swallsEndpoints);
    // console.log(southWallArr)
    for (var i = 0; i < southWallArr.length; i++) {
      var southWall = southWallArr[i]
      var southWallPointIndex = southWall.pid1
      let southWallPoints = []
      var southWallBasePoint1 = points[southWallPointIndex]
      var southWallBasePoint2 = points[southWallPointIndex + 1]
      southWallBasePoint1[1] = floorHeight * index
      southWallBasePoint2[1] = floorHeight * index
      southWallPoints.push(southWallBasePoint1)
      southWallPoints.push(southWallBasePoint2)
      southWallPoints.push([southWallBasePoint1[0], floorHeight * (index + 1), southWallBasePoint1[2]])
      southWallPoints.push([southWallBasePoint2[0], floorHeight * (index + 1), southWallBasePoint2[2]])
      const geometryOfSouth = this.getGeometryForSouthWall(southWallPoints)
      const basqPoint1Vector = new THREE.Vector3(southWallBasePoint1[0], southWallBasePoint1[1], southWallBasePoint1[2]);
      const basqPoint2Vector = new THREE.Vector3(southWallBasePoint2[0], southWallBasePoint2[1], southWallBasePoint2[2]);
      const distance = basqPoint1Vector.distanceTo(basqPoint2Vector);
      let materialSouth;
      if ((index + 1) % 3 == 0) {
        materialSouth =
          new THREE.MeshLambertMaterial({
            map: new THREE.CanvasTexture(this.getTextCanvas1(distance, floorHeight, index + 1)),
            color: 0xFED7BF,
            emissive: 0xFED7BF, // 可选：设置自发光颜色，让材质在没有光照时也能有一定的亮度  
            emissiveIntensity: 0.5,
            side: THREE.BackSide,
            depthTest: true,
            polygonOffset: true,
            polygonOffsetFactor: 1,
            polygonOffsetUnits: 1,
          })
      } else {
        materialSouth =
          new THREE.MeshLambertMaterial({
            color: 0xFED7BF,
            emissive: 0xFED7BF, // 可选：设置自发光颜色，让材质在没有光照时也能有一定的亮度  
            emissiveIntensity: 0.5,
            side: THREE.BackSide,
            depthTest: true,
            polygonOffset: true,
            polygonOffsetFactor: 1,
            polygonOffsetUnits: 1,
          })
      }

      var meshSouth = new THREE.Mesh(geometryOfSouth, materialSouth)
      meshSouth.castShadow = true
      meshSouth.receiveShadow = true

      let houseName = buildingNumber + "_" + houseRoom.unit + "_" + Number(index + 1) + "_" + houseRoom.room + "_" + southWall.name
      this.southWallMeshMap.set(houseName, meshSouth)
      buildGroup.add(meshSouth)

      // 创建边缘几何体
      const edgeGeometry = new THREE.EdgesGeometry(geometryOfSouth, 1);
      const edgeMaterial = new THREE.LineBasicMaterial({
        color: 0x8D7669,
        depthTest: true,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: 3,
      });

      const edgeLines = new THREE.LineSegments(edgeGeometry, edgeMaterial);
      edgeLines.renderOrder = 1;
      buildGroup.add(edgeLines)
    }
  }

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

  getGeometryWithoutSouthWall(points, southWallPointIndex, baseHeight, floorHeight) {
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
      if (southWallPointIndex.indexOf(j) != -1) {
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

  getGeometryForSouthWall(southWallPoints) {
    var vertices = []
    for (let i = 0; i < southWallPoints.length; i++) {
      vertices.push(
        new THREE.Vector3(southWallPoints[i][0], southWallPoints[i][1], southWallPoints[i][2])
      )
    }
    var faces = []
    faces.push(new THREE.Face3(0, 1, 3))
    faces.push(new THREE.Face3(3, 2, 0))

    var geometry = new THREE.Geometry()
    geometry.vertices = vertices
    geometry.faces = faces
    geometry.computeFaceNormals() //自动计算法向量
    // console.log(geometry.faces)
    geometry.faceVertexUvs = [
      [
        [
          new THREE.Vector2(1, 0),
          new THREE.Vector2(0, 0),
          new THREE.Vector2(0, 1),
        ],
        [
          new THREE.Vector2(0, 1),
          new THREE.Vector2(1, 1),
          new THREE.Vector2(1, 0),
        ],
      ],
    ];

    return geometry
  }

  getTextCanvas1(width, height, floor) {
    width *= 10
    height *= 10
    const baseFontSize = 24;
    const fontSize = Math.min(width / 2, height / 2, baseFontSize * 2);
    var canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    var ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    ctx.font = fontSize + 'px bold';
    ctx.fillStyle = 'black';
    const text = floor + '层';
    const textWidth = ctx.measureText(text).width;
    const textHeight = parseInt(ctx.font, 10);
    const x = canvas.width - textWidth; // 水平居右
    const y = canvas.height / 2 + textHeight / 4;
    ctx.fillText(text, x, y);

    return canvas;
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

}