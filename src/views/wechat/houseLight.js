import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'
import { CSS2DRenderer} from "three/examples/jsm/renderers/CSS2DRenderer"
import { Earcut } from '../3dUtils/earcut'
import { SunCalc } from '../3dUtils/suncalc'
import computeHull from 'monotone-convex-hull-2d';

export default class Sun {
  constructor(options) {
    const { element , historyId , time , date , history, onRotate} = options
    // this._isDev = dev && isDev // 在开发环境显示辅助线
    this._element = element // canvas 元素
    this._history = history
    this._historyId = historyId
    this._time = time;
    this._date = date;
    this._onRotate = onRotate
    // this._lon = utils.deg2rad(lon) // 经度弧度
    // this._lat = utils.deg2rad(lat) // 纬度弧度
    // this._date = date // 日期
    // this._time = time // 时间（数字）
    // this._baseMap = baseMap
    // this._R = 2000 // 太阳轨迹半径
    // this._floorHeight = 6 // 单层楼的高度
    // this._floorColors = [0xffffff, 0xefefef]
    // this._onRotate = onRotate
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
      0.1,
      50000
    )
    camera.position.set(0, 300, 300)
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
    directionalLight.shadow.camera.left = -200
    directionalLight.shadow.camera.right = 200
    directionalLight.shadow.camera.top = 200
    directionalLight.shadow.camera.bottom = -200
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
    control.minDistance = 100
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
      polygonOffsetFactor: -1,
      polygonOffsetUnits: 3,
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

  createBuildings(historyDetail){
    
    let that = this
    let outlinePoints = []
    //添加观测楼
    var coordinates = this.transFormPositions(historyDetail.destPosition);
    //设置中心点(观测楼第一个点)
    this.lon = historyDetail.destLng;
    this.lat = historyDetail.destLat;

    let observePoints = this.transformCoordinate(coordinates)
    outlinePoints.push(...observePoints)
    var observeBuild = this.addBuildingForObserve(observePoints, historyDetail.destTotalFloor, historyDetail.destFloorHeight, historyDetail.destObserverFloor);
    this._scene.add(observeBuild)

    //添加观测楼标志
    const observeCenter = this.computeCenter(observePoints);
    const coneGeometry = new THREE.ConeGeometry(3, 8, 32, 1, false, true); // 底部开放，形成倒置效果  
    const coneMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 }); // 绿色材质  
    const invertedCone = new THREE.Mesh(coneGeometry, coneMaterial);
    invertedCone.position.x = observeCenter[0];
    invertedCone.position.y = historyDetail.destTotalFloor * historyDetail.destFloorHeight + 18;
    invertedCone.position.z = observeCenter[1];
    invertedCone.rotation.x = Math.PI;
    this._scene.add(invertedCone);

    //添加遮挡楼
    if(historyDetail.barrierReqList && historyDetail.barrierReqList.length > 0){
      historyDetail.barrierReqList.forEach(function (item) {
        var coordinates = that.transFormPositions(item.positionList);
        var points = that.transformCoordinate(coordinates)
        outlinePoints.push(...points)
        var barrierBuild = that.addBuilding(points, item.totalFloor, item.floorHeight);
        that._scene.add(barrierBuild)
      });
    }
    this.addOutLine(outlinePoints)
  }

  addOutLine(buildPoints){
    let hullBox = computeHull(buildPoints)
    // // 计算中心点
    let centerX = 0
    let centerY = 0
    let shapePoints = []
    hullBox.forEach((hullPoint) => {
      centerX += buildPoints[hullPoint][0]
      centerY += buildPoints[hullPoint][1]
      shapePoints.push(buildPoints[hullPoint])
    });
    centerX /= hullBox.length
    centerY /= hullBox.length
    let ifFirst = false

    //小区地面
    const plane = new THREE.Shape();
    shapePoints.forEach((hullPoint) => {
      // 计算新的顶点坐标
      const newX = centerX + (hullPoint[0] - centerX) * 1.3
      const newY = centerY + (hullPoint[1] - centerY) * 1.3
      if(!ifFirst){
        plane.moveTo(newX, newY)
        ifFirst = true
      }
      else{
        plane.lineTo(newX, newY)
      }
    })
    plane.closePath();
    const planeMaterial = new THREE.MeshBasicMaterial({
      color: "white",
      transparent: true,
      opacity: 0.5,
    });
    const planeGeometry = new THREE.ShapeGeometry(plane);
    planeGeometry.rotateX(-Math.PI / 2);
    const planeMesh = new THREE.Mesh(planeGeometry, planeMaterial);
    planeMesh.position.y = 0.5
    this._scene.add(planeMesh)

    const edgeGeometry = new THREE.EdgesGeometry(planeGeometry, 1);
    const edgeMaterial = new THREE.LineBasicMaterial({
      color: 0xFF0000,
      depthTest: true,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: 3,
    });
    const edgeLines = new THREE.LineSegments(edgeGeometry, edgeMaterial);

    edgeLines.renderOrder = 1;
    this._scene.add(edgeLines)
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

  addBuilding(points, totalFloor, floorHeight) {
    points = points.map(point => {
      return [point[0], 0, -point[1]]
    })
    const group = new THREE.Group()
    for (let i = 0; i < totalFloor; i++) {
      group.add(this.createBuildingFloor(points, floorHeight, i,))
    }
    return group;
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

  createBuildingFloor(points, floorHeight, index) {
    const geometry = this.getGeometry(points, floorHeight * index, floorHeight)
    const materialArr = [
      // 侧面
      new THREE.MeshLambertMaterial({
        color: 0xF8F8F8,
        emissive: 0xF8F8F8, // 可选：设置自发光颜色，让材质在没有光照时也能有一定的亮度  
        emissiveIntensity: 0.5,
        side: THREE.BackSide,
        depthTest: true,
        polygonOffset: true,
        polygonOffsetFactor: 1,
        polygonOffsetUnits: 2,
      }),
      // 顶部
      new THREE.MeshBasicMaterial({
        color: 0xF8F8F8,
        side: THREE.BackSide,
        depthTest: true,
        polygonOffset: true,
        polygonOffsetFactor: 1,
        polygonOffsetUnits: 2,
      }),
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
    this._scene.add(edgeLines)

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
        emissiveIntensity: 0.3, // 可选：设置自发光的强度  
        depthTest: true,
        polygonOffset: true,
        polygonOffsetFactor: 1,
        polygonOffsetUnits: 2,
      }),
      // 顶部
      new THREE.MeshLambertMaterial({
        color: 0xF8F8F8,
        side: THREE.BackSide,
        depthTest: true,
        polygonOffset: true,
        polygonOffsetFactor: 1,
        polygonOffsetUnits: 2,
      }),
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
    this._scene.add(edgeLines)

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

  dateUpdate(date){
    var suncalc = SunCalc.getTimes(date, this.lat, this.lon);
    var sunrise = suncalc.sunrise;
    var sunset = suncalc.sunset;

    let sun = [sunrise,sunset];
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
    const sun = this.calculatePositionOfSun(date,this.lon,this.lat);
  
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