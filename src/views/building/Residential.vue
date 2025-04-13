<template>
    <div class="canvas-view" style="height: 100%; width: 100%;overflow: hidden;">
      <a-watermark :content="watermark" style="height: 100%;background-color: #63718B;">
        <canvas id="canvasRender" style="z-index: 100"></canvas>
        <div class="compass">
          <img class="icon" src="/images/compass.png" :style="{ transform: 'rotate(' + rotateValue + 'deg)' }" />
        </div>
        <div class="bottom-card">
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
          <div class="times">
            <p>
              日出时间：<span class="value">{{ riseTimeStr }}</span>
            </p>
            <p>
              日落时间：<span class="value">{{ setTimeStr }}</span>
            </p>
          </div>
          <div class="solar-terms">
            <van-button class="btn" :class="{ active: dateStr === item.date }" plain type="default" v-for="item in dates"
              :key="item.date" @click="choseDate(item.date)">{{ item.name }}</van-button>
          </div>
        </div>
      </a-watermark>
    </div>
  </template>
  
  <script>
  import HouseLightOpen from "./ResidentialOpen";
  import { getCommunityDetail, isMember, getResidentialByCode, getRoadByCode } from '@/utils/api'
  import utils from '@/utils/index'
  import { Modal } from 'ant-design-vue';
  
  // import axios from "axios";
  
  let sunView = null;
  let currentDate = new Date();
  export default {
    name: "ResidentialBuilding",
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
  
        dates: [
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
          {
            name: '冬至',
            date: currentDate.getFullYear() + '-12-21'
          },
        ]
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
          result.barrierReqList.forEach(element => {
            this.buildNumbers.push(element.buildingNumber);
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
          })
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
      },
  
      onAllBuildingClick() {
        sunView.switchHighlightBuilding();
      },
  
      choseBuildNumber(number) {
        sunView.switchHighlightBuilding(number)
      },
  
      onChoseBuildNumber(number) {
        this.selectBuildNumber = number
      },
  
      cancelBuildNumber() {
        this.selectBuildNumber = ""
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
  
  
  .bottom-card {
    position: absolute;
    bottom: 16px;
    left: 50%;
    transform: translateX(-50%);
    width: 90vw;
    max-width: 600px;
    border-radius: 6px;
    padding: 10px;
    background: rgba(255, 255, 255, 0.8);
  
    display: flex;
    flex-flow: column nowrap;
    gap: 8px;
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
        background: linear-gradient(to top, #fafafa, #888888, #fafafa);
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
        min-width: 48px;
        width: 60px;
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
  
    .times {
      height: 24px;
      display: flex;
      flex-flow: row nowrap;
      justify-content: space-between;
      align-items: center;
      font-size: 14px;
      margin: 0 10px;
  
      .value {
        // margin-left: 4px;
        color: rgb(255, 58, 58);
      }
    }
  
    .solar-terms {
      min-height: fit-content;
      display: flex;
      flex-wrap: wrap;
      justify-content: space-around;
      gap: 8px;
  
      .btn {
        min-width: 48px;
        width: 60px;
        height: 24px;
        white-space: nowrap;
        font-size: 14px;
        border: none;
  
        display: flex;
        justify-content: center;
        align-items: center;
        text-align: center;
        box-sizing: border-box;
      }
  
      .active {
        color: #fff;
        background: linear-gradient(90deg,
            rgba(245, 170, 70, 1) 0%,
            rgba(245, 100, 17, 1) 100%);
      }
    }
  }
  </style>