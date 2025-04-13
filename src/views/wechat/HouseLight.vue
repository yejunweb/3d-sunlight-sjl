<template>
    <div class="canvas-view" style="height: 100%; width: 100%">
      <canvas id="canvasRender"></canvas>
      <div class="compass">
        <img class="icon" src="/images/compass.png" :style="{ transform: 'rotate(' + rotateValue + 'deg)' }" />
      </div>
      <div class="bottom-card">
        <div class="top">
          <div class="title">当前日期：</div>
          <div class="date" @click="showCalendar = true">
            <span class="text">{{ dateStr }}</span>
            <van-icon name="arrow" />
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
            日出时间<span class="value">{{ riseTimeStr }}</span>
          </p>
          <p>
            日落时间<span class="value">{{ setTimeStr }}</span>
          </p>
        </div>
        <div class="solar-terms">
          <van-button class="btn" :class="{ active: dateStr === item.date }" plain size="mini" type="default"
            v-for="item in dates" :key="item.date" @click="choseDate(item.date)">{{ item.name }}</van-button>
        </div>
      </div>
      <van-calendar v-model:show="showCalendar" :min-date="minDate" :max-date="maxDate" @confirm="onChoseDate" />
    </div>
    <div class="show-pay" v-show="!isVip">
      <button class="showPay-btn" type="button" @click="showPay" :disabled="isShowPayPopup"></button>
    </div>
    <div class="message-box" v-show="isShowPayPopup">
      <div class="message-box-content">
        <div class="body">
          <h4>会员提示</h4>
          <p>该内容只对会员用户开放，是否现在开通会员？</p>
        </div>
        <div class="footer">
          <button class="footer-btn cancel" @click="popupCancel">取消</button>
          <button class="footer-btn confirm" @click="popupConfirm">确定</button>
        </div>
      </div>
    </div>
  </template>
  
  <script>
  import HouseLight from "./houseLight";
  import { tokenStore } from '@/utils/stores'
  import { getHistoryDetail, getMemberRechargeRecords } from '@/utils/api'
  import utils from '@/utils/index'
  import wx from "weixin-js-sdk";
  
  // import axios from "axios";
  
  let sunView = null;
  let currentDate = new Date();
  export default {
    name: "HouseLight",
    props: {
      msg: String,
    },
  
    data() {
      return {
        isVip: false,
        isShowPayPopup: false,
        idleTimer: null,
  
        date: new Date(),
        time: 9, // 0-24
        riseTimeStr: '',
        setTimeStr: '',
        noonTimeStr: '',
        dayLengthStr: '',
        minDate: new Date(2024, 0, 1),
        maxDate: new Date(2024, 11, 31),
        showCalendar: false,
        playing: false,
        loaded: false,
        rotateValue: 0,
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
        return utils.dateFormat(this.date, 'yyyy-MM-dd')
      },
      timeStr() {
        return utils.timeFormat(this.time)
      }
    },
  
    mounted() {
      document.title = "采光分析大师";
      this.throttledHandleRotateChange = utils.throttle(this.handleRotateChange, 200)
      let historyId = this.$route.query.historyId;
      let token = this.$route.query.token;
      let store = tokenStore();
      store.setToken(token);
      let date = new Date();
  
      getHistoryDetail(historyId).then((res) => {
        let result = res.data.result;
        sunView = new HouseLight({
          element: document.querySelector("#canvasRender"),
          historyId: historyId,
          date: date,
          history: result,
          onRotate: this.throttledHandleRotateChange,
        });
        sunView.init();
        this.onChoseDate(date);
      })
  
      getMemberRechargeRecords().then((memberRes) => {
        console.log("memberRes:", memberRes);
        if (memberRes.data.success && memberRes.data.result.id) {
          this.isVip = true;
        }
  
        this.resetIdleTimer();
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
      onChoseDate(val) {
        this.showCalendar = false
        val.setHours(12);
        let sun = sunView.dateUpdate(val);
        this.date = val;
        this.riseTimeStr = this.timeFormat(sun[0].getHours()) + ":" + this.timeFormat(sun[0].getMinutes());
        this.setTimeStr = this.timeFormat(sun[1].getHours()) + ":" + this.timeFormat(sun[1].getMinutes());
        this.time = this.timeToValue(sun[0]);
      },
  
      choseDate(dateStr) {
        let date = new Date(dateStr);
        this.date = date;
        this.onChoseDate(date);
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
  
      showPay() {
        this.isShowPayPopup = true;
      },
  
      popupCancel() {
        this.isShowPayPopup = false;
        // 用户点击了“取消”，不执行跳转
        console.log("开通会员跳转被取消");
  
        this.resetIdleTimer();
      },
  
      popupConfirm() {
        this.isShowPayPopup = false;
        // 用户点击了“确定”，执行跳转
        wx.miniProgram.navigateTo({
          url: '../../../exchange/exchange?historyId=' + this.$route.query.historyId
        });
  
        this.resetIdleTimer();
      },
  
      resetIdleTimer() {
        if (!this.isVip) {
          if (this.idleTimer) {
            clearTimeout(this.idleTimer);
          }
          this.idleTimer = setTimeout(() => {
            this.showPay();
          }, 5000);
        }
      }
    },
  };
  </script>
  <!-- Add "scoped" attribute to limit CSS to this component only -->
  <style scoped lang="scss">
  .compass {
    position: absolute;
    top: 20px;
    left: 20px;
    font-size: 0;
    border-radius: 50%;
    overflow: hidden;
  }
  
  .icon {
    width: 80px;
    height: 80px;
  }
  
  .canvas-view {
    position: absolute;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
  
    .bottom-card {
      position: absolute;
      bottom: 16px;
      left: 50%;
      transform: translateX(-50%);
      width: 90vw;
      max-width: 600px;
      background: rgba(255, 255, 255, 0.8);
      border-radius: 6px;
      padding: 0 10px 4px;
  
      .top {
        display: flex;
        justify-content: center;
        /* justify-content: space-between; */
        line-height: 45px;
  
        .title {
          // flex: 1;
          // font-size: 18px;
          // font-weight: 500;
          // overflow: hidden;
          // text-overflow: ellipsis;
          // white-space: nowrap;
        }
  
        .date {
  
          // display: flex;
          // justify-content: flex-end;
          // align-items: center;
          // width: 100px;
          // font-size: 14px;
          .text {
            margin-right: 4px;
          }
        }
      }
  
      .time-wrapper {
        display: flex;
        flex-flow: row nowrap;
        align-items: center;
        justify-content: center;
        margin: 10px 0;
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
          margin: 0 20px;
        }
      }
  
      .times {
        display: flex;
        flex-flow: row nowrap;
        /* justify-content: space-around; */
        justify-content: space-between;
        font-size: 14px;
        margin: 0 10px;
  
        .value {
          margin-left: 4px;
          color: rgb(255, 58, 58);
        }
      }
  
      .solar-terms {
        display: flex;
        flex-wrap: wrap;
        justify-content: space-around;
  
        .btn {
          font-size: 14px;
          flex: 1 1 20%;
          margin: 5px;
        }
  
        .active {
          border: none;
          color: #fff;
          background: linear-gradient(90deg,
              rgba(250, 170, 70, 1) 0%,
              rgba(250, 100, 17, 1) 100%);
        }
      }
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
  }
  
  .show-pay {
    width: 100vw;
    height: 100vh;
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 100;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  
  .showPay-btn {
    width: 100vw;
    height: 100vh;
    border: none;
    background-color: rgba(255, 255, 255, 0.1);
  }
  
  .message-box {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(0, 0, 0, 0.5);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 101;
  }
  
  .message-box-content {
    width: 80%;
    border-radius: 10px;
    background-color: rgb(215, 215, 215);
    display: flex;
    flex-direction: column;
    align-items: center;
  }
  
  .body {
    background-color: #fff;
    border-radius: 10px 10px 0 0;
    padding: 0 5vw 1vh;
  }
  
  .footer {
    width: 100%;
    height: 6vh;
    display: flex;
    justify-content: space-between;
  }
  
  .footer-btn {
    width: 50%;
    border: none;
    background-color: #fff;
  }
  
  .cancel {
    border-radius: 0 0 0 10px;
    background-color: #ddd;
    color: black;
  }
  
  .confirm {
    border-radius: 0 0 10px 0;
    background-color: #4CAF50;
    color: white;
  }
  </style>
  