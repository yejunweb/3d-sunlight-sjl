<template>
  <div class="canvas-view" style="height: 100%; width: 100%;overflow: hidden;">
    <a-watermark :content="watermark" style="height: 100%;background-color: #63718B;">
      <canvas id="canvasRender" style="z-index: 100"></canvas>
      <div class="compass">
        <img class="icon" src="/images/compass.png" :style="{ transform: 'rotate(' + rotateValue + 'deg)' }" />
      </div>
      <div v-if="showCard" class="mask" @click="onFoldClick"> </div>
      <div v-if="!clearScreen" class="top" :style="showCard ? 'bottom: 80vh;' : 'bottom: 40vh;'">
        <p>
          日出时间：<span class="value">{{ riseTimeStr }}</span>
        </p>
        <button v-if="!showCard" class="top-btn unfold-btn" @click="onUnfoldClick"> </button>
        <button v-if="showCard" class="top-btn fold-btn" @click="onFoldClick"> </button>
        <p>
          日落时间：<span class="value">{{ setTimeStr }}</span>
        </p>
      </div>
      <div v-if="!clearScreen" class="bottom-card" :style="showCard ? 'bottom: 0;' : 'bottom: -40vh;'">
        <div class="building-box">
          <button class="allBuilding-btn" v-if="selectBuildNumber != ''" @click="onAllBuildingClick"> 全部楼栋 </button>
          <div class="buildNumber-terms" id='nav'>
            <van-button class="btn" :class="{ active: selectBuildNumber === item }" plain type="default"
              v-for="(item, index) in buildNumbers" :key="index" :id="'button-' + index"
              @click="choseBuildNumber(item)">{{
                item + ' #' }}</van-button>
          </div>
        </div>
        <div class="time-wrapper">
          <div class="time-slider">
            <span class="time">00:00</span>
            <van-slider v-model="time" @change="onTimeChange" :min="0" :max="24" :step="0.0001" button-size="14px" />
            <span class="time">24:00</span>
            <span class="current-time">{{ timeStr }}</span>
          </div>
          <van-icon class="play" @click="play" :name="playing ? 'pause-circle-o' : 'play-circle-o'" size="24px" />
        </div>
        <div class="solar-terms">
          <van-button class="btn" :class="{ active: dateStr === item.date }" plain type="default" v-for="item in dates"
            :key="item.date" @click="choseDate(item.date)">{{ item.name }}</van-button>
        </div>
        <div class="table-container">
          <table class="floor-unit-table" v-if="sunShineData.find(item => item.buildingNumber === tableBuildNumber)">
            <thead class="header">
              <tr>
                <th style="width: 32px; max-width: 40px; min-width: 20px;"> </th>
                <th :colspan="getRoomsByUnit(tableBuildNumber, unit)" v-for="unit in units" :key="unit"> {{ unit }} 单元
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="floor in Array.from({ length: totalFloor }, (_, i) => totalFloor - i)" :key="floor">
                <td style="font-size: 14px;"> {{ floor }} 层</td>
                <td style="border: 1px solid #f8fafd;" v-for="(item, index) in getRoomsByAFloor(units)" :key="index">
                  <div class="table-cell" :style="tooltipVisible === getHouseNumber(floor, item.room, item.unit) ?
                    setTooltipStyle(getSWallDataListByHouse(tableBuildNumber, floor, item.unit, item.room)) :
                    setTableCellStyle(getHouseSunShineTimeAverage(tableBuildNumber, floor, item.unit, item.room))"
                    @click="toggleTooltip(getHouseNumber(floor, item.room, item.unit))">
                    {{ getHouseNumber(floor, item.room) }} <br>
                    <span class="sunshine-time">
                      {{ getHouseSunShineTimeAverage(tableBuildNumber, floor, item.unit, item.room) }}h
                    </span>
                    <div class="tooltip" :class="floor < totalFloor - 1 ? 'tooltip-up' : 'tooltip-down'"
                      v-if="tooltipVisible === getHouseNumber(floor, item.room, item.unit)">
                      <table class="swall-cell"
                        :style="setTooltipStyle(getSWallDataListByHouse(tableBuildNumber, floor, item.unit, item.room))">
                        <td :style="setTableCellStyle((sWallData.sunshineTime / 60).toFixed(1))"
                          v-for="sWallData in getSWallDataListByHouse(tableBuildNumber, floor, item.unit, item.room)"
                          :key="sWallData.id" @click="drawChartPopup(sWallData, tableBuildNumber, tooltipVisible)">
                          {{ sWallData.swallName }} <br>
                          <span class="sunshine-time">
                            {{ (sWallData.sunshineTime / 60).toFixed(1) }}h
                          </span>
                        </td>
                      </table>
                    </div>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
          {{sunShineData.find(item => item.buildingNumber === tableBuildNumber) ? '' : '暂无采光分析数据'}}
          <div class="tip-container">
            <div class="note">
              <p>日照时长(小时):</p>
              <div class="color-card">
                <div class="color-item" v-for="(item, index) in colorCard" :key="index">
                  <div class="color-item-marker" :style="{ backgroundColor: item }"></div>
                  <div class="color-item-text">{{ setColorCardText(index) }}.</div>
                </div>
              </div>
            </div>
            <p class="disclaimer">
              日照免责声明：<br>
              日照数据系依据政府规划公示图纸等第三方资料，经专业建模模拟评测得出。
              请注意，该数据存在一定误差，仅供参考，不应单独作为交易决策的依据。
              针对具体房源的日照信息及准确性，请务必与开发商核实，并以开发商提供的信息为准。
              鉴于施工规划变更、图纸精度等因素，本日照模拟结果可能与实际情况存在偏差，数据仅供参考。
            </p>
          </div>
        </div>
      </div>
      <div class="chart-pop-up"
        :style="chartPopupVisible ? 'transform: translate(-50%, -50%);' : 'transform: translate(100%, 100%);'">
        <div class="sunburst-item">
          <div ref="sunburstChartRef" style="width: 100%; height: 100%;"></div>
          <div class="legend-container">
            <div class="legend-item" v-for="(item, index) in sunburstChartLevels" :key="index">
              <div class="legend-text">{{ item.name }}</div>
              <div class="legend-marker" :style="{ backgroundColor: item.color }"></div>
            </div>
          </div>
        </div>
        <div class="close" @click="chartPopupVisible = false">✖</div>
      </div>
      <div class="clear-screen-btn" @click="clearScreen ? clearScreen = false : clearScreen = true">
        {{ clearScreen ? '显示' : '清屏' }}
      </div>
    </a-watermark>
  </div>
</template>

<script>
import HouseLightOpen from "./houseLightOpen";
import { getCommunityDetail, isMember, getHouseSunshineData, getResidentialByCode, getRoadByCode } from '@/utils/api'
import utils from '@/utils/index'
import { Modal } from 'ant-design-vue';
import * as echarts from 'echarts';

// import axios from "axios";

let sunView = null;
let currentDate = new Date();
export default {
  name: "ResidentialSunShine",
  props: {
    msg: String,
  },

  data() {
    return {
      idleTimer: null,
      watermark: [],
      rotateValue: 0,
      residentialName: '',
      currentDate: new Date(),
      time: 9, // 0-24
      riseTimeStr: '',
      setTimeStr: '',
      playing: false,
      selectBuildNumber: '',
      buildNumbers: [],
      tableBuildNumber: '',
      dates: [
        {
          name: '冬至',
          date: currentDate.getFullYear() + '-12-21'
        },
        {
          name: '立春',
          date: currentDate.getFullYear() + '-02-04'
        },
        {
          name: '春分',
          date: currentDate.getFullYear() + '-03-20'
        },
        {
          name: '立夏',
          date: currentDate.getFullYear() + '-05-05'
        },
        {
          name: '夏至',
          date: currentDate.getFullYear() + '-06-21'
        },
        {
          name: '立秋',
          date: currentDate.getFullYear() + '-08-07'
        },
        {
          name: '秋分',
          date: currentDate.getFullYear() + '-09-22'
        },
        {
          name: '立冬',
          date: currentDate.getFullYear() + '-11-07'
        },
      ],
      colorCard: [
        '#feefe7',
        '#fde0cf',
        '#fcd0b7',
        '#fbc1a0',
        '#fab188',
        '#f9a270',
        '#f89258',
        '#f78341',
        '#f67328',
        '#f56411',
      ],
      showCard: false,
      residenceData: [],
      units: 0,
      totalFloor: 0,
      sunShineData: [],
      houseRoomMap: new Map(),
      tooltipVisible: '',
      chartPopupVisible: false,
      sunburstChartLevels: [
        { name: '日照时间段', color: 'rgb(250, 100, 17)' },
        { name: '采光时间段', color: 'rgb(250, 170, 70)' },
        { name: '建筑遮挡', color: 'rgb(111, 111, 111)' },
        { name: '自遮挡', color: 'rgb(170, 170, 170)' }
      ],
      clearScreen: false,
    }
  },

  computed: {
    dateStr() {
      return utils.dateFormat(this.currentDate, 'yyyy-MM-dd')
    },
    timeStr() {
      return utils.timeFormat(this.time)
    }
  },

  mounted() {
    document.title = "采光分析大师";
    this.throttledHandleRotateChange = utils.throttle(this.handleRotateChange, 200)
    let code = this.$route.params.code;
    let date = new Date();
    // this.countDown();

    getResidentialByCode(code).then((res) => {
      if (res.data.code == 200) {
        this.residentialName = res.data.result.residentialName;
      }
    })

    isMember(code).then((res) => {
      if (res.data.result != null && res.data.result.businessMemberType != 2) {
        this.watermark = ['采光分析大师', '秦皇岛三角龙科技有限公司'];
        document.title = this.residentialName;
      }
      if (res.data.result == null) {
        this.watermark = ['采光分析大师', '秦皇岛三角龙科技有限公司'];
      }
    })

    getCommunityDetail(code).then((res) => {
      if (res.data.code == 200) {
        let result = res.data.result;
        // console.log(result)
        result.barrierReqList.forEach(element => {
          if (element.houseList.length > 0) {
            this.buildNumbers.push(element.buildingNumber);
          }
          this.residenceData.push({
            buildingNumber: element.buildingNumber,
            units: element.units,
            totalFloor: element.totalFloor
          })
        });
        // 对 buildNumbers 进行排序
        this.buildNumbers.sort((a, b) => {
          const isANumber = !isNaN(parseFloat(a)) && isFinite(a);
          const isBNumber = !isNaN(parseFloat(b)) && isFinite(b);
          if (isANumber && isBNumber) {
            return parseFloat(a) - parseFloat(b);
          } else if (isANumber) {
            return -1;
          } else if (isBNumber) {
            return 1;
          }
          return a.localeCompare(b);
        });
        this.tableBuildNumber = this.buildNumbers[0];
        getRoadByCode(code).then((res) => {
          if (res.data.code == 200) {
            result.roadList = res.data.result;
          } 
          sunView = new HouseLightOpen({
            element: document.querySelector("#canvasRender"),
            historyId: code,
            date: date,
            history: result,
            onRotate: this.throttledHandleRotateChange,
            onCancelBuildSelect: this.cancelBuildNumber,
            onChoseBuildNumber: this.onChoseBuildNumber
          });
          sunView.init();
          this.choseDate(this.dates[0].date);
        })
      } else {
        Modal.error({
          title: '提示',
          content: res.data.message || '请求失败',
        })
      }
    })
  },

  unmounted() {
    sunView.destroy()
  },

  beforeUnmount() {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
    }
  },

  methods: {
    onUnfoldClick() {
      this.showCard = true;
      if (this.selectBuildNumber == "") {
        this.selectBuildNumber = this.buildNumbers[0];
        this.choseBuildNumber(this.selectBuildNumber);
      }
    },

    onFoldClick() {
      this.showCard = false;
      this.tooltipVisible = null;
    },

    countDown() {
      const modal = Modal.info({
        title: '采光分析大师',
        content: `该模块由秦皇岛三角龙科技有限公司提供技术支持！`,
        okText: '知道了'
      });
      setTimeout(() => {
        modal.destroy();
      }, 5000);
    },

    choseDate(dateStr) {
      let date = new Date(dateStr);
      this.currentDate = date;
      date.setHours(12);
      let sun = sunView.dateUpdate(date);
      this.riseTimeStr = this.timeFormat(sun[0].getHours()) + ":" + this.timeFormat(sun[0].getMinutes());
      this.setTimeStr = this.timeFormat(sun[1].getHours()) + ":" + this.timeFormat(sun[1].getMinutes());
      this.time = this.timeToValue(sun[0]);

      getHouseSunshineData(this.$route.params.code, this.dates.find(item => item.date === dateStr).name).then((res) => {
        if (res.data.code == 200) {
          sunView.updateSouthSunShine(res.data.result);
          this.sunShineData = res.data.result;
          this.sunShineData.forEach(data => {
            let key = data.buildingNumber + data.unit
            let roomArr = []
            if (this.houseRoomMap.has(key)) {
              roomArr = this.houseRoomMap.get(key)
            }
            if (!roomArr.includes(Number(data.room))) {
              roomArr.push(Number(data.room))
              this.houseRoomMap.set(key, roomArr)
            }
          })
          for (let [key, value] of this.houseRoomMap) {
            value.sort((a, b) => a - b)
            this.houseRoomMap.set(key, value)
          }
          console.log(this.houseRoomMap)
          if (this.sunShineData != null) {
            this.units = this.residenceData.find(item => item.buildingNumber === this.tableBuildNumber).units;
            this.totalFloor = this.residenceData.find(item => item.buildingNumber === this.tableBuildNumber).totalFloor;
          }
        }
      })
    },

    onAllBuildingClick() {
      this.onFoldClick();
      sunView.switchHighlightBuilding();
    },

    choseBuildNumber(number) {
      sunView.switchHighlightBuilding(number)
    },

    onChoseBuildNumber(number) {
      this.selectBuildNumber = number;
      this.tableBuildNumber = number;

      this.units = this.residenceData.find(item => item.buildingNumber === this.tableBuildNumber).units;
      this.totalFloor = this.residenceData.find(item => item.buildingNumber === this.tableBuildNumber).totalFloor;
    },

    cancelBuildNumber() {
      this.selectBuildNumber = "";
      this.tableBuildNumber = this.buildNumbers[0];

      this.units = this.residenceData.find(item => item.buildingNumber === this.tableBuildNumber).units;
      this.totalFloor = this.residenceData.find(item => item.buildingNumber === this.tableBuildNumber).totalFloor;
    },

    onTimeChange(val) {
      console.log(val);
      sunView.time = val
    },

    play() {
      this.playing = !this.playing
      clearTimeout(this.timer)
      this.timer = 0
      if (this.playing) {
        this.timer = setInterval(() => {
          let interval = 0.05
          if (this.time < 4 || this.time > 21) {
            interval = 0.5 // 晚上加速
          }
          this.time = this.time + interval
          if (this.time > 24) {
            this.time = 0
          }
          sunView.time = this.time
        }, 50)
      }
    },

    timeToValue(time) {
      let value = 0;
      var hour = time.getHours();
      var minute = time.getMinutes();
      value = hour + minute / 60;
      return value;
    },

    timeFormat(time) {
      if (time < 10)
        return '0' + time
      else
        return time
    },

    handleRotateChange(value) {
      this.rotateValue = value * 180 / Math.PI
    },

    setTableCellStyle(value) {
      let i = Math.trunc(value);
      if (value > i) {
        i = i + 1;
      }
      if (value > 8) {
        i = 9;
      }
      let color = '#000000';
      if (i > 4) {
        color = '#ffffff';
      }
      return `background-color: ${this.colorCard[i]}; color: ${color};`
    },

    getRoomsByUnit(building, unit) {
      let key = building + unit
      let roomArr = this.houseRoomMap.get(key)
      if(roomArr == null){
        return 0
      }
      return roomArr.length
    },

    getRoomsByAFloor(units) {
      let rooms = []
      for (let i = 0; i < units; i++) {
        let key = this.tableBuildNumber + (i + 1)
        let roomArr = this.houseRoomMap.get(key)
        if(roomArr){
          roomArr.forEach(room => {
            rooms.push({
              'unit': i + 1,
              'room': room
            })
          })
        }
      }
      return rooms
    },

    getSWallDataListByHouse(building, floor, unit, room) {
      let houseSunShineData = this.sunShineData.find(item =>
        item.buildingNumber === building && item.floorNumber === floor && item.unit == unit && item.room == room
      );
      if (houseSunShineData == null) {
        return null;
      } else {
        return houseSunShineData.swallDataList;
      }
    },

    getHouseSunShineTimeAverage(building, floor, unit, room) {
      let sWallDataList = this.getSWallDataListByHouse(building, floor, unit, room);
      if (sWallDataList == null || sWallDataList.length === 0) {
        return null;
      } else {
        let sumMin = 0;
        for (let i = 0; i < sWallDataList.length; i++) {
          sumMin += sWallDataList[i].sunshineTime;
        }
        let avgHour = ((sumMin / sWallDataList.length) / 60).toFixed(1);
        return avgHour;
      }
    },

    toggleTooltip(houseNumber) {
      if (!this.showCard) {
        this.onUnfoldClick()
      }

      // 如果当前点击的room与tooltipVisible相同，则隐藏tooltip，否则显示tooltip
      if (this.tooltipVisible === houseNumber) {
        this.tooltipVisible = null; // 隐藏tooltip
      } else {
        this.tooltipVisible = houseNumber; // 显示tooltip
      }
    },

    getHouseNumber(floor, room, unit) {
      if (room < 10) {
        room = "0" + room;
      }
      if (unit != null && unit != '') {
        return unit + '单元-' + floor + room;
      }
      return floor + room;
    },

    setTooltipStyle(sWallDataList) {
      let color = "";

      for (let i = 0; i < sWallDataList.length; i++) {
        let value = (sWallDataList[i].sunshineTime / 60).toFixed(1);
        let j = Math.trunc(value);
        if (value > j) {
          j = j + 1;
        }
        if (value > 8) {
          j = 9;
        }

        if (i != 0) {
          color += ",";
        }
        color += this.colorCard[j];
      }

      if (!color.includes(",")) {
        color += "," + color;
      }

      return `background: linear-gradient(to right, ${color}); color: gold;`
    },

    drawChartPopup(sWallData, tableBuildNumber, tooltipVisible) {
      this.chartPopupVisible = true;

      let subtext = tableBuildNumber + '#-' + tooltipVisible + '-' + sWallData.swallName;

      if (this.chartPopupVisible) {
        this.initSunburstChart(sWallData, subtext);
      }
    },

    initSunburstChart(sWallData, subtext) {
      // 初始化图表实例
      var sunburstChart = echarts.init(this.$refs.sunburstChartRef);

      // 准备数据
      const sunriseMinutes = this.timeStringToMinutes(this.riseTimeStr);
      const sunsetMinutes = this.timeStringToMinutes(this.setTimeStr);
      const dayLength = sunsetMinutes - sunriseMinutes;
      const nightlength = 1440 - dayLength;
      const startAngle = -(sunriseMinutes / 1440 * 360 + 90);

      let datas = this.setSunburstChartDatas(sWallData);

      var data = [
        {
          name: '白天',
          value: dayLength,
          itemStyle: {
            color: this.sunburstChartLevels[0].color
          },
          label: {
            color: 'rgb(255, 255, 255)'
          },
          children: datas
        },
        {
          name: '夜晚',
          value: nightlength,
          itemStyle: {
            color: '#e7e7e7'
          },
          label: {
            color: 'rgb(0, 0, 0)'
          }
        }
      ];

      // 绘制旭日图
      sunburstChart.setOption({
        title: {
          text: '采光时间段分布情况',
          subtext: subtext,
          textStyle: {
            color: '#ffffff'
          },
          subtextStyle: {
            color: '#eeeeee'
          }
        },
        series: [{
          type: 'sunburst',
          sort: undefined,
          silent: true,
          center: ['50%', '68%'],
          radius: ['20%', '70%'],
          label: {
            fontSize: 14,
            rotate: 'radial'
          },
          levels: [
            {},
            {
              r0: '20%',
              r: '40%',
              label: {
                rotate: 'tangential'
              }
            },
            {
              r0: '40%',
              r: '70%',
              label: {
                fontSize: 12,
                position: 'outside',
                rotate: 'tangential'
              }
            }
          ],
          startAngle: startAngle,    // 设置起始角度
          data: data
        }]
      });
    },

    setSunburstChartDatas(sWallData) {
      let datas = [];
      let sunshineStarArray = [];
      let sunshineEndArray = [];
      let sunshinePeriod = sWallData.sunshinePeriod;
      if (sunshinePeriod && sunshinePeriod != null && sunshinePeriod != '') {
        let sunshine = sunshinePeriod.split(',').filter(item => item.trim() !== '');
        for (let i = 0; i < sunshine.length; i++) {
          let [starTime, endTime] = sunshine[i].split('-');
          sunshineStarArray.push(this.timeStringToMinutes(starTime));
          sunshineEndArray.push(this.timeStringToMinutes(endTime));
        }
      } else {
        console.info('sunshinePeriod 数组为空');
      }

      let oneselfShadowStarArray = [];
      let oneselfShadowEndArray = [];
      let otherShadowStarArray = [];
      let otherShadowEndArray = [];
      let shadowPeriod = sWallData.shadowPeriod;
      if (shadowPeriod && shadowPeriod != null && shadowPeriod != '') {
        let shadow = shadowPeriod.split(',').filter(item => item.trim() !== '');
        for (let i = 0; i < shadow.length; i++) {
          if (shadow[i].includes("~")) {
            let [starTime, endTime] = shadow[i].split('~');
            oneselfShadowStarArray.push(this.timeStringToMinutes(starTime));
            oneselfShadowEndArray.push(this.timeStringToMinutes(endTime));
          }
          if (shadow[i].includes("-")) {
            let [starTime, endTime] = shadow[i].split('-');
            otherShadowStarArray.push(this.timeStringToMinutes(starTime));
            otherShadowEndArray.push(this.timeStringToMinutes(endTime));
          }
        }
      } else {
        console.info('shadowPeriod 数组为空');
      }

      // 使用concat方法合并数组  
      let starTimeMinutesArray = sunshineStarArray.concat(oneselfShadowStarArray, otherShadowStarArray);
      // 使用sort方法排序，传入一个比较函数来确保按数值排序  
      starTimeMinutesArray.sort(function (a, b) {
        return a - b;
      });
      let endTimeMinutesArray = sunshineEndArray.concat(oneselfShadowEndArray, otherShadowEndArray);
      endTimeMinutesArray.sort(function (a, b) {
        return a - b;
      });

      if (starTimeMinutesArray.length == endTimeMinutesArray.length) {
        for (let i = 0; i < starTimeMinutesArray.length; i++) {
          let starTimeMinutes = starTimeMinutesArray[i];
          let endTimeMinutes = endTimeMinutesArray[i];
          let value = endTimeMinutes - starTimeMinutes;

          if (sunshineStarArray.includes(starTimeMinutes)) {
            datas.push({
              value: value,
              itemStyle: {
                color: this.sunburstChartLevels[1].color
              },
              name: this.minutesToTimeString(starTimeMinutes) + ' ~ ' + this.minutesToTimeString(endTimeMinutes),
              label: {
                color: this.sunburstChartLevels[1].color
              }
            });
          }
          else if (oneselfShadowStarArray.includes(starTimeMinutes)) {
            datas.push({
              value: value,
              itemStyle: {
                color: this.sunburstChartLevels[3].color
              },
              name: this.minutesToTimeString(starTimeMinutes) + ' ~ ' + this.minutesToTimeString(endTimeMinutes),
              label: {
                color: this.sunburstChartLevels[3].color
              }
            });
          }
          else if (otherShadowStarArray.includes(starTimeMinutes)) {
            datas.push({
              value: value,
              itemStyle: {
                color: this.sunburstChartLevels[2].color
              },
              name: this.minutesToTimeString(starTimeMinutes) + ' ~ ' + this.minutesToTimeString(endTimeMinutes),
              label: {
                color: this.sunburstChartLevels[2].color,
                textShadowBlur: 1, // 阴影模糊半径
                textShadowColor: '#ffffff', // 阴影颜色
              }
            });
          }
        }
      }

      return datas;
    },

    // '07:15:10' To '436'
    timeStringToMinutes(timeString) {
      // 分割时间字符串，并尝试将每个部分转换为数字  
      const parts = timeString.split(':').map(str => parseFloat(str) || 0);    // 使用 parseFloat 允许处理小数秒（如果需要的话）  

      // 检查我们是否得到了正确数量的部分（2个或3个）  
      if (parts.length < 2) {
        throw new Error('Invalid time string format');
      }

      const hours = parts[0];
      const minutes = parts[1];
      const seconds = parts.length > 2 ? parts[2] : 0;    // 如果没有秒数，默认为0  

      // 计算总分钟数  
      const totalMinutes = hours * 60 + minutes + ((seconds % 60) > 0 ? 1 : 0);

      return totalMinutes;
    },

    // '436' To '07:16'
    minutesToTimeString(minutes) {
      // 确保输入是整数或可以转换为整数的值  
      const totalMinutes = Math.floor(minutes);

      // 计算小时、分钟和秒  
      const hours = Math.floor(totalMinutes / 60);
      const remainingMinutes = totalMinutes % 60;

      // 使用两位数字格式化小时、分钟和秒  
      const formattedHours = String(hours).padStart(2, '0');
      const formattedMinutes = String(remainingMinutes).padStart(2, '0');

      // 拼接并返回时间字符串  
      return `${formattedHours}:${formattedMinutes}`;
    },

    setColorCardText(i) {
      if (i == 0) {
        return '0';
      }
      else if (i == 9) {
        return '>8';
      }
      else {
        return (Number(i - 1)) + '~' + i;
      }
    }
  },
};
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style scoped lang="scss">
.canvas-view {
  position: absolute;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
}

.compass {
  position: absolute;
  top: 20px;
  left: 20px;
  font-size: 0;
  border-radius: 50%;
  overflow: hidden;

  .icon {
    width: 80px;
    height: 80px;
  }
}

/* --------------------------------------------- */
.mask {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.6);
  z-index: 88;
}

.top {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  max-width: 800px;
  width: 90vw;
  height: auto;

  display: flex;
  flex-flow: row nowrap;
  justify-content: space-between;
  font-size: 14px;
  color: rgba(255, 255, 255, 0.88);
  text-shadow: 1px 1px 1px rgba(8, 8, 8, 0.8);
  z-index: 888;

  .value {
    color: rgb(245, 170, 70);
    text-shadow: 1px 1px 1px rgba(245, 100, 17, 0.8);
  }

  .top-btn {
    width: 20vw;
    border: none;
    outline: none;
    box-shadow: none;
    background: transparent;
    background-size: 28px;
    background-position: center;
    /* 将背景图居中 */
    background-repeat: no-repeat;
    /* 防止背景图重复 */
    opacity: 0.8;
    /* 设置按钮整体的透明度 */
    filter: drop-shadow(0 0 2px rgba(0, 0, 0, 0.8));
    /* 添加阴影 */
    cursor: pointer;
  }

  .unfold-btn {
    background-image: url('/public/images/unfold.png');
    /* 文字上下浮动 */
    animation: float 1s infinite alternate;
  }

  @keyframes float {
    0% {
      transform: translateY(0);
    }

    100% {
      transform: translateY(-5px);
    }
  }

  .fold-btn {
    background-image: url('/public/images/fold.png');
  }
}

.bottom-card {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  max-width: 800px;
  width: 90vw;
  height: calc(80vh - 24px);
  border-radius: 8px 8px 0 0;
  padding: 12px 10px 24px;

  display: flex;
  flex-flow: column nowrap;
  gap: 8px;
  background: rgba(255, 255, 255, 1);
  z-index: 888;

  .building-box {
    width: 100%;
    min-height: fit-content;
    display: flex;
    flex-flow: row nowrap;

    .allBuilding-btn {
      width: auto;
      height: 24px;
      white-space: nowrap;
      font-size: 14px;
      border: none;
      background: transparent;
      position: relative;
    }

    .allBuilding-btn::after {
      content: '';
      position: absolute;
      right: 0;
      top: 50%;
      transform: translateY(-50%);
      width: 2px;
      height: 88%;
      background: linear-gradient(to top, #f8fafd, #f3f5fb, #f8fafd);
      pointer-events: none;
      /* 使伪元素不干扰按钮的点击事件 */
    }
  }

  .buildNumber-terms {
    min-height: fit-content;
    white-space: nowrap;
    display: flex;
    overflow-x: auto;
    overflow-y: hidden;
    gap: 8px;

    .btn {
      min-width: 60px;
      width: 12vw;
      height: 24px;
      white-space: nowrap;
      font-size: 14px;
      border: none;

      display: flex;
      justify-content: center;
      align-items: center;
      text-align: center;
      box-sizing: border-box;
      background: transparent;
    }

    .active {
      position: relative;
    }

    .active::after {
      content: '';
      position: absolute;
      bottom: 0;
      left: 50%;
      transform: translateX(-50%);
      width: 50%;
      height: 8px;
      /* 边框厚度 */
      background: linear-gradient(to right, rgba(245, 170, 70, 0.8), rgba(245, 170, 70, 0));
      /* 渐变色 */
      border-radius: 8px;
      /* 圆角处理 */
      z-index: -1;
      /* 确保边框在内容下方 */
    }
  }

  .time-wrapper {
    display: flex;
    flex-flow: row nowrap;
    align-items: center;
    justify-content: center;
    margin: 8px 0;
    line-height: 20px;

    .time-slider {
      flex: 1;
      display: flex;
      align-items: center;

      .time {
        font-size: 14px;
        margin: 0 10px;
      }

      .current-time {
        padding: 1px 4px 0;
        font-size: 14px;
        background: rgba(0, 0, 0, 0.08);
      }
    }

    .play {
      margin-left: 12px;
      margin-right: 6px;
    }
  }

  .solar-terms {
    min-height: 8vw;
    white-space: nowrap;
    display: flex;
    overflow-x: auto;
    overflow-y: hidden;
    gap: 8px;

    .btn {
      min-width: 60px;
      width: 16vw;
      height: 8vw;
      min-height: 24px;
      max-height: 48px;
      /* 防止文本换行 */
      white-space: nowrap;
      font-size: 14px;
      background: #f5f7fc;
      border: none;

      display: flex;
      justify-content: center;
      /* 水平居中 */
      align-items: center;
      /* 垂直居中 */
      text-align: center;
      /* 确保文字居中 */
      box-sizing: border-box;
      /* 包括内边距和边框在宽度和高度内 */
    }

    .active {
      color: rgb(245, 170, 70);
      background: rgba(245, 170, 70, 0.18);
    }
  }

  .table-container {
    width: 100%;
    min-height: 60px;
    max-height: 100%;
    overflow-y: auto;

    .floor-unit-table {
      width: 100%;
      background-color: #f8fafd;
      border-collapse: collapse;
      /* 去除表格的默认间距 */

      .header {
        background-color: #f8fafd;
        font-size: 14px;
        position: sticky;
        /* 固定表头在容器顶部 */
        top: 0px;
        z-index: 2;
      }

      .header th {
        padding: 8px;
        background-color: #f3f5fb;
        border: 2px solid #f8fafd;
        border-top: 0;
        position: sticky;
        top: 0px;
        z-index: 3;
      }

      .table-cell {
        min-width: 40px;
        padding: 6px;
        position: relative;
        font-size: 12px;

        .sunshine-time {
          font-weight: bold;
          font-size: 14px;
        }
      }
    }
  }

  .tooltip {
    position: absolute;
    left: 50%;
    padding: 2px;
    border-radius: 5px;
    background: linear-gradient(to top, gold, #f3f5fb, gold);
    box-shadow: 0 8px 16px 1px rgba(0, 0, 0, 0.2);
    z-index: 1;

    ::after {
      content: '';
      position: absolute;
      left: 50%;
      margin-left: -6px;
      border-width: 6px;
      border-style: solid;
    }
  }

  .tooltip-up {
    top: 0;
    transform: translate(-50%, -100%);

    ::after {
      bottom: -12px;
      border-color: gold transparent transparent transparent;
    }
  }

  .tooltip-down {
    bottom: 0;
    transform: translate(-50%, 100%);

    ::after {
      top: -12px;
      border-color: transparent transparent gold transparent;
    }
  }

  .swall-cell {
    padding: 0;
    border-radius: 5px;
  }

  .swall-cell td {
    padding: 2px 8px;
    border-left: 1px solid #f3f5fb;
    white-space: nowrap;
  }

  .swall-cell td:first-child {
    border-left: none;
  }
}

.chart-pop-up {
  position: absolute;
  top: 50%;
  left: 50%;
  // transform: translate(-50%, -50%);
  width: 100%;
  height: 100%;

  display: flex;
  align-items: center;
  justify-content: center;
  flex-flow: column nowrap;
  gap: 8px;

  background: transparent;
  z-index: 999;

  .sunburst-item {
    position: relative;
    width: 80vw;
    height: 80vw;
    display: flex;
    align-items: center;
    justify-content: center;

    padding: 8px;
    border-radius: 8px;
    background: rgba(0, 0, 0, 0.8);
    box-shadow: 0 8px 8px 2px rgba(0, 0, 0, 0.2);

    .legend-container {
      position: absolute;
      top: 8px;
      right: 8px;
      display: flex;
      flex-direction: column;
      align-items: flex-end;

      .legend-item {
        display: flex;
        align-items: center;

        .legend-text {
          font-size: 12px;
          margin-right: 6px;
          color: #ffffff;
        }

        .legend-marker {
          width: 20px;
          height: 12px;
          margin-right: 2px;
          border-radius: 20%;
        }
      }
    }
  }

  .close {
    width: 8vw;
    height: 8vw;
    border-radius: 80px;

    display: flex;
    align-items: center;
    justify-content: center;

    color: #ffffff;
    background: rgba(0, 0, 0, 0.8);
  }
}

.tip-container {
  width: 100%;
  height: auto;
  min-height: fit-content;

  display: flex;
  flex-flow: column nowrap;
  gap: 8px;

  color: #888888;

  .note {
    font-size: 12px;
    text-align: left;

    display: flex;
    flex-flow: column nowrap;

    .color-card {
      width: 100%;
      display: flex;
      flex-flow: row nowrap;

      .color-item {
        width: 10%;
        display: flex;
        flex-flow: column nowrap;

        .color-item-marker {
          width: 100%;
          height: 24px;
        }

        .color-item-text {
          display: flex;
          align-items: center;
          justify-content: center;
          color: #000000;
        }
      }
    }
  }

  .disclaimer {
    font-size: 10px;
    text-align: left;
  }
}

.clear-screen-btn {
  position: absolute;
  top: 8px;
  right: 8px;

  width: 40px;
  height: 40px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;

  font-size: 12px;
  color: #000000;
  background-color: rgba(255, 255, 255, 0.6);

  z-index: 8;
}
</style>
