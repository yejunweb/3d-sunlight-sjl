<template>
    <div>
      <a-watermark :content="watermark" style="height: 100%;background-color: #63718B;">
        <div class="canvas-con" ref="container" @pointerdown="onMouseClick"></div>
      </a-watermark>
    </div>
  
    <!-- 新增信息展示悬浮窗 -->
    <div v-if="selectedBuilding" class="building-info-panel">
      <div class="info-header">
        <h3>{{ selectedBuilding.buildingNumber }}号楼信息</h3>
        <a @click="selectedBuilding = null">关闭</a>
      </div>
      <div class="nav-buttons">
         <a v-for="(building, index) in buildingList"
          :key="building.id"
          @click="switchBuilding(index)"
          :class="{ active: selectedBuilding?.id === building.id }">
          {{ building.buildingNumber }}#
        </a>
      </div>
      <div class="info-content">
        <div class="info-item">
          <span>层高：</span>
          <span>{{ selectedBuilding.floorHeight || '--' }}</span>
        </div>
        <div class="info-item">
          <span>楼层数：</span>
          <span>{{ selectedBuilding.totalFloor || '--' }}</span>
        </div>
        <div class="info-item">
          <span>单元数：</span>
          <span>{{ selectedBuilding.units || '--' }}</span>
        </div>
      </div>
    </div>
  </template>
  
  <script setup>
  import { onMounted, ref, reactive  } from 'vue';
  import { useRoute } from 'vue-router';
  import * as THREE from 'three';
  import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
  import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
  import { selectDistancesInfo, isMember, getResidentialByCode } from '@/utils/api';
  import computeHull from 'monotone-convex-hull-2d';
  
  const container = ref(null);
  const route = useRoute();
  // 创建楼和楼间距线
  const buildings = [];
  const distances = [];
  const buildingBorders = []; // 用于存储楼的边框线
  const buildingLabels = []; // 用于存储楼的名称标签
  const distanceLabels = []; // 用于存储楼间距线长度标签
  // 配置颜色
  const backgroundColor = 0xDDF2FF; // 底图颜色
  const planeColor = 0xB2E1FF; // 地面颜色
  const buildingColor = 0xf0f0f0; // 楼的颜色
  const distanceLineColor = 0x1975D5; // 间距线的颜色
  const highlightColor = 0xFEB26F; // 高亮颜色
  const borderColor = 0x000000; // 楼的边框颜色
  // 新增响应式数据
  const selectedBuilding = ref(null);
  const buildingList = reactive([]);
  let camera;
  let controls;
  let watermark =  ref(['采光分析大师', '秦皇岛三角龙科技有限公司']);
  let residentialName = ref(null);
  
  onMounted(() => {
    document.title = "采光分析大师";
    let code = route.params.code;
  
    getResidentialByCode(code).then((res) => {
      if (res.data.code == 200) {
        residentialName.value = res.data.result.residentialName;
      }
    })
  
    // 判断用户是否是会员
    isMember(code).then((res) => {
      if (res.data.result.businessMemberType == 2) {
        watermark.value = [];
        document.title = residentialName.value;
      }
    });
    // 创建场景
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(backgroundColor);
  
    // 创建相机，设置为俯视图视角
    camera = new THREE.PerspectiveCamera(30,window.innerWidth / window.innerHeight,1,5000)
    // camera = new THREE.PerspectiveCamera(30,window.innerWidth / window.innerHeight,150,200000)
  
    // 创建渲染器
    const renderer = new THREE.WebGLRenderer();
    renderer.setSize(window.innerWidth-8, window.innerHeight-4);
    renderer.antialias = true
    renderer.setPixelRatio(window.devicePixelRatio)
    container.value.appendChild(renderer.domElement);
  
    // 创建 2D 标签渲染器
    const labelRenderer = new CSS2DRenderer();
    labelRenderer.domElement.style.pointerEvents = 'none'
    labelRenderer.setSize(window.innerWidth, window.innerHeight);
    labelRenderer.domElement.style.position = 'absolute';
    labelRenderer.domElement.style.top = '0px';
    container.value.appendChild(labelRenderer.domElement);
  
    // 创建轨道控制器，允许放大、缩小、拖动平移
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableRotate = false; // 禁用旋转，只保留缩放和平移
  
    function animate() {
      requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
      labelRenderer.render(scene, camera);
    }
  
    function createOutline(buildPoints) {
      let hullBox = computeHull(buildPoints)
      const hullShape = new THREE.Shape();
      // 计算中心点
      let centerX = 0;
      let centerY = 0;
      hullBox.forEach((hullPoint) => {
        centerX += buildPoints[hullPoint][0];
        centerY += buildPoints[hullPoint][1];
      });
      centerX /= hullBox.length;
      centerY /= hullBox.length;
      // 扩大比例
      const scaleFactor = 1.1; // 可根据需要调整此值
      let ifFirst = false
      hullBox.forEach((hullPoint) => {
        // 计算新的顶点坐标
        const newX = centerX + (buildPoints[hullPoint][0] - centerX) * scaleFactor;
        const newY = centerY + (buildPoints[hullPoint][1] - centerY) * scaleFactor;
        if(!ifFirst){
          hullShape.moveTo(newX, newY);
          ifFirst = true
        }
        else{
          hullShape.lineTo(newX, newY);
        }
      })
      hullShape.closePath();
      const buildingGeometry = new THREE.ShapeGeometry(hullShape);
      const buildingMaterial = new THREE.MeshBasicMaterial({
        color: "white",
        transparent: true,
        opacity: 0.5
      });
      const hullmesh = new THREE.Mesh(buildingGeometry, buildingMaterial);
      scene.add(hullmesh);
    }
  
    selectDistancesInfo(code).then((res) => {
      if (res.data.success &&res.data.result.buildingList.length > 0) {
        buildingList.push(...res.data.result.buildingList); // 存储完整楼栋列表
        const distanceList = res.data.result.distanceList;
  
        let totalX = 0;
        let totalY = 0;
        let buildingCount = 0;
        let outlinePoints = [];
        buildingList.forEach((building) => {
          const points = JSON.parse(building.buildingPoints);
          points.forEach(point => {
            point.y = -point.y; // 反转 y 轴方向，因为 Three.js 的坐标系统是左上角为原点
            totalX += point.x;
            totalY += point.y;
            buildingCount++;
            outlinePoints.push([point.x, point.y]);
          });
          // 创建形状
          const shape = new THREE.Shape();
          shape.moveTo(points[0].x, points[0].y);
          for (let i = 1; i < points.length; i++) {
            shape.lineTo(points[i].x, points[i].y);
          }
          shape.closePath();
  
          // 创建几何体
          const buildingGeometry = new THREE.ShapeGeometry(shape);
          const buildingMaterial = new THREE.MeshBasicMaterial({ color: buildingColor, side: THREE.DoubleSide });
          const mesh = new THREE.Mesh(buildingGeometry, buildingMaterial);
          scene.add(mesh);
          mesh.dataId = building.id;
          buildings.push(mesh);
  
          // 创建楼的边框线
          const edgesGeometry = new THREE.EdgesGeometry(buildingGeometry);
          const edgesMaterial = new THREE.LineBasicMaterial({ color: borderColor });
          const edges = new THREE.LineSegments(edgesGeometry, edgesMaterial);
          mesh.add(edges);
          buildingBorders.push(edges);
  
          // 创建楼的名称标签
          const buildingName = building.buildingNumber + '#' || '';
          const labelDiv = document.createElement('div');
          labelDiv.className = 'building-label';
          labelDiv.textContent = buildingName;
          labelDiv.style.color = '#fff';
          labelDiv.style.backgroundColor = '#0265CF';
          labelDiv.style.fontSize = '16px';
          labelDiv.style.textAlign = 'center';
          labelDiv.style.border = '2px solid #0265CF';
          labelDiv.style.borderRadius = '100%';
          labelDiv.style.padding = '4px 8px';
          labelDiv.style.fontWeight = 'bold';
          const label = new CSS2DObject(labelDiv);
          // 计算楼栋的中心点
          let centerX = 0;
          let centerY = 0;
          points.forEach(point => {
            centerX += point.x;
            centerY += point.y;
          });
          centerX /= points.length;
          centerY /= points.length;
          label.position.set(centerX-1, centerY-3, 0);
          mesh.add(label);
          buildingLabels.push(label);
        });
  
        createOutline(outlinePoints);
  
        // 创建地图平面
        const centerX = totalX / buildingCount;
        const centerY = totalY / buildingCount;
       // 计算所有建筑点到中心点的最大距离
        let maxDistance = 0;
        buildingList.forEach((building) => {
          const points = JSON.parse(building.buildingPoints);
          points.forEach(point => {
            const dx = point.x - centerX;
            const dy = point.y - centerY;
            const distance = Math.sqrt(dx * dx + dy * dy);
            if (distance > maxDistance) {
              maxDistance = distance;
            }
          });
        });
        // 添加一定的边距
        const margin = 0; // 可以根据需要调整边距大小
        const radius = maxDistance * 1 + margin;
        // 设置相机
        controls.minDistance = radius/5;
        controls.maxDistance = radius*5;
        camera.near = radius/10;
        camera.far = radius*10;
        camera.updateProjectionMatrix();
  
        // 创建地图平面
        const segments =  72; // 圆形的分段数，值越大越平滑
        const circleGeometry = new THREE.CircleGeometry(radius, segments);
        const circleMaterial = new THREE.MeshBasicMaterial({ color: planeColor, side: THREE.DoubleSide });
        const circlePlane = new THREE.Mesh(circleGeometry, circleMaterial);
        circlePlane.position.set(centerX, centerY, -1); // 将平面放置在建筑下方，并设置到中心点
        scene.add(circlePlane);
  
        camera.position.set(centerX, centerY, 1.5*radius)
        const target = new THREE.Vector3(centerX, centerY, 0); // x, y, z 是目标点的坐标
        camera.lookAt(target)
        //设置相机朝向位置
        controls.target = new THREE.Vector3(centerX,centerY,0);
  
        // 创建楼间距线
        distanceList.forEach((distance) => {
          const segment = JSON.parse(distance.distanceSegment);
          const segmentPoints = segment.map(point => new THREE.Vector3(point.x, -point.y, 0));
          const distanceGeometry = new THREE.BufferGeometry().setFromPoints(segmentPoints);
          // 设置 linewidth 属性来加粗线条
          const distanceMaterial = new THREE.LineBasicMaterial({ color: distanceLineColor, linewidth: 3 });
          const distanceLine = new THREE.Line(distanceGeometry, distanceMaterial);
          scene.add(distanceLine);
          distanceLine.dataId = distance.id;
          distanceLine.aBuildingId = distance.aBuildingId;
          distanceLine.bBuildingId = distance.bBuildingId;
          distances.push(distanceLine);
          // 创建楼间距线长度标签
          const startPoint = segmentPoints[0];
          const endPoint = segmentPoints[1];
          const lengthLabelDiv = document.createElement('div');
          lengthLabelDiv.className = 'distance-label';
          lengthLabelDiv.textContent = distance.displayDistance + 'm';
          lengthLabelDiv.style.color = '#52C216';
          lengthLabelDiv.style.fontSize = '14px';
          lengthLabelDiv.style.textAlign = 'center';
          lengthLabelDiv.style.backgroundColor = 'rgba(178, 225, 255, 0)';
          lengthLabelDiv.style.borderRadius = '5%';
          lengthLabelDiv.style.padding = '2px 4px';
          lengthLabelDiv.style.fontWeight = 'bold';
          const lengthLabel = new CSS2DObject(lengthLabelDiv);
          // 计算楼间距线中点位置
          const midPoint = new THREE.Vector3().addVectors(startPoint, endPoint).multiplyScalar(0.5);
          lengthLabel.position.copy(midPoint);
          scene.add(lengthLabel);
          distanceLabels.push(lengthLabel);
        });
        animate();
      }else{
        alert('暂无数据') 
      }
    });
  });
  
  function onMouseClick(event) {
    // 计算鼠标在标准化设备坐标中的位置
    const mouse = new THREE.Vector2();
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
  
    // 通过鼠标位置更新射线
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, camera);
  
    // 计算射线与场景中物体的交点
    const intersects = raycaster.intersectObjects(buildings);
  
    if (intersects.length > 0) {
      buildings.forEach(building => {
        building.material.color.set(buildingColor);
      });
      buildingBorders.forEach(border => {
        border.material.color.set(borderColor);
      })
      distanceLabels.forEach(label => {
        label.element.style.backgroundColor = 'rgba(178, 225, 255, 0)';
      });
      const clickedBuilding = intersects[0].object;
      // 高亮楼
      clickedBuilding.material.color.set(highlightColor);
      // 高亮对应的楼边框线
      const buildingIndex = buildings.indexOf(clickedBuilding);
      selectedBuilding.value = buildingList[buildingIndex]; // 更新选中楼栋
      buildingBorders[buildingIndex].material.color.set(highlightColor);
      // 高亮对应的楼间距线
      distances.forEach((distance,index) => {
        if (
          distance.aBuildingId === clickedBuilding.dataId ||
          distance.bBuildingId === clickedBuilding.dataId
        ) {
          distance.material.color.set(highlightColor);
          distanceLabels[index].element.style.backgroundColor = '#ffffff';
        } else {
          distance.material.color.set(distanceLineColor);
        }
      });
    }
  }
  
  // 新增切换楼栋方法
  function switchBuilding(index) {
    if (index < 0 || index >= buildingList.length) return;
    selectedBuilding.value = buildingList[index];
    // 触发对应楼栋的高亮
    buildings.forEach(b => b.material.color.set(buildingColor));
    const targetBuilding = buildings[index];
    targetBuilding.material.color.set(highlightColor);
    // 触发对应楼的边框线的高亮
    buildingBorders.forEach(b => b.material.color.set(borderColor));
    const targetBuildingBorder = buildingBorders[index];
    targetBuildingBorder.material.color.set(highlightColor);
    // 触发对应楼间距线的高亮
    distances.forEach((d,i) => {
      d.material.color.set(distanceLineColor)
      distanceLabels[i].element.style.backgroundColor = 'rgba(178, 225, 255, 0)';
    });
    const targetDistances = distances.filter(d => d.aBuildingId === selectedBuilding.value.id || d.bBuildingId === selectedBuilding.value.id);
    targetDistances.forEach(d => {
      d.material.color.set(highlightColor)
      const i = distances.indexOf(d);
      distanceLabels[i].element.style.backgroundColor = '#ffffff';
    });
  
    const points = JSON.parse(selectedBuilding.value.buildingPoints);
    // 计算楼栋的中心点
    let centerX = 0;
    let centerY = 0;
    points.forEach(point => {
      centerX += point.x;
      centerY += -point.y;
    });
    centerX /= points.length;
    centerY /= points.length;
    camera.position.x = centerX;
    camera.position.y = centerY;
    const target = new THREE.Vector3(centerX, centerY, 0); // x, y, z 是目标点的坐标
    camera.lookAt(target)
    //设置相机朝向位置
    controls.target = new THREE.Vector3(centerX,centerY,0);
  }
  </script>
  
  <style scoped>
  .canvas-con {
    width: 100%;
    height: 100%;
  }
  .building-label {
    position: absolute;
    pointer-events: none;
  }
  .distance-label {
    position: absolute;
    pointer-events: none;
  }
  
  /* 新增悬浮窗样式 */
  .building-info-panel {
    position: fixed;
    bottom: 10px;
    left: 50%;
    transform: translateX(-50%);
    width: 90%;
    max-width: 400px;
    background: rgba(255, 255, 255, 0.95);
    border-radius: 12px;
    padding: 0 15px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    z-index: 1000;
    height: 240px;
  }
  
  .info-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  
  .info-content {
    display: grid;
    gap: 8px;
  }
  
  .info-item {
    display: flex;
    justify-content: space-between;
    padding: 8px 0;
    border-bottom: 1px solid #eee;
  }
  
  .nav-buttons {
    display: flex;
    gap: 10px;
    overflow-x: scroll;
  }
  
  .nav-buttons a {
    padding: 6px 12px;
    border-radius: 4px;
    border: 1px solid #1975D5;
    cursor: pointer;
    transition: all 0.3s ease;
  }
  
  .nav-buttons a.active {
    background-color: #1975D5;
    color: white;
  }
  
  .nav-buttons a:hover {
    background-color: #1975D5;
    color: white;
  }
  
  /* 移动端适配 */
  @media (max-width: 768px) {
    .building-info-panel {
      width: 90%;
      padding: 0 12px;
    }
  
    .info-header h3 {
      font-size: 16px;
    }
  }
  </style>
  