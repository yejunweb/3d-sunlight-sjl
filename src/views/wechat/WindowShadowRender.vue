<template>
  <div id="canvas-view" class="canvas-view" style="height: 100%; width: 100%">
    <canvas id="canvasRender"></canvas>
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
          <van-slider
            v-model="time"
            @change="onTimeChange"
            :min="0"
            :max="24"
            :step="0.0001"
            button-size="14px"
          />
          <span class="time">24:00</span>
          <span class="current-time">{{ timeStr }}</span>
        </div>
        <van-icon
          class="play"
          @click="play"
          :name="playing ? 'pause-circle-o' : 'play-circle-o'"
          size="24px"
        />
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
        <van-button
          class="btn"
          :class="{ active: dateStr === item.date }"
          plain
          size="mini"
          type="default"
          v-for="item in dates"
          :key="item.date"
          @click="choseDate(item.date)"
          >{{ item.name }}</van-button
        >
      </div>
    </div>
    <van-calendar
      v-model:show="showCalendar"
      :min-date="minDate"
      :max-date="maxDate"
      @confirm="onChoseDate"
    />
  </div>
</template>

<script>
import WindowShadowRender from "./windowShadowRender";
import { tokenStore } from "@/utils/stores";
import utils from "@/utils/index";

let sunView = null;
let currentDate = new Date();
export default {
  name: "WindowShadowRender",
  props: {
    historyDetail: Object,
    windowData: Object,
  },

  data() {
    return {
      date: new Date(),
      time: 9, // 0-24
      riseTimeStr: "",
      setTimeStr: "",
      noonTimeStr: "",
      dayLengthStr: "",
      minDate: new Date(2024, 0, 1),
      maxDate: new Date(2024, 11, 31),
      showCalendar: false,
      playing: false,
      loaded: false,
      dates: [
        {
          name: "立春",
          date: currentDate.getFullYear() + "-02-04",
        },
        {
          name: "春分",
          date: currentDate.getFullYear() + "-03-20",
        },
        {
          name: "立夏",
          date: currentDate.getFullYear() + "-05-05",
        },
        {
          name: "夏至",
          date: currentDate.getFullYear() + "-06-21",
        },
        {
          name: "立秋",
          date: currentDate.getFullYear() + "-08-07",
        },
        {
          name: "秋分",
          date: currentDate.getFullYear() + "-09-22",
        },
        {
          name: "立冬",
          date: currentDate.getFullYear() + "-11-07",
        },
        {
          name: "冬至",
          date: currentDate.getFullYear() + "-12-21",
        },
      ],
    };
  },

  computed: {
    dateStr() {
      return utils.dateFormat(this.date, "yyyy-MM-dd");
    },
    timeStr() {
      return utils.timeFormat(this.time);
    },
  },

  mounted() {
    let token = this.$route.query.token;
    let store = tokenStore();
    store.setToken(token);
    let date = new Date();
    let canvasWidth = document.querySelector("#canvas-view").offsetWidth;
    let canvasHeight = document.querySelector("#canvas-view").offsetHeight;

    sunView = new WindowShadowRender({
      element: document.querySelector("#canvasRender"),
      canvasWidth: canvasWidth,
      canvasHeight: canvasHeight,
      date: date,
      history: this.historyDetail,
      windowData: this.windowData,
    });
    sunView.init();
    this.onChoseDate(date);
  },

  unmounted() {
    sunView.destroy();
  },

  methods: {
    onChoseDate(val) {
      this.showCalendar = false;
      val.setHours(12);
      let sun = sunView.dateUpdate(val);
      this.date = val;
      this.riseTimeStr =
        this.timeFormat(sun[0].getHours()) +
        ":" +
        this.timeFormat(sun[0].getMinutes());
      this.setTimeStr =
        this.timeFormat(sun[1].getHours()) +
        ":" +
        this.timeFormat(sun[1].getMinutes());
      this.time = this.timeToValue(sun[0]);
    },

    choseDate(dateStr) {
      let date = new Date(dateStr);
      this.date = date;
      this.onChoseDate(date);
    },

    onTimeChange(val) {
      console.log(val);
      sunView.time = val;
    },

    play() {
      this.playing = !this.playing;
      clearTimeout(this.timer);
      this.timer = 0;
      if (this.playing) {
        this.timer = setInterval(() => {
          let interval = 0.1;
          if (this.time < 4 || this.time > 21) {
            interval = 0.5; // 晚上加速
          }
          this.time = this.time + interval;
          if (this.time > 24) {
            this.time = 0;
          }
          sunView.time = this.time;
        }, 50);
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
      if (time < 10) return "0" + time;
      else return time;
    },

    // handleRotateChange(value) {
    //   this.rotateValue = (value * 180) / Math.PI;
    // },
  },
};
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style scoped lang="scss">

.canvas-view {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  .bottom-card {
    position: absolute;
    bottom: 2%;
    left: 0;
    right: 0;
    margin-left: 5%;
    margin-right: 5%;
    opacity: 0.8;
    background: #ffffff;
    border-radius: 6px;
    padding: 0 10px 4px;
    box-shadow: 0 8px 8px 1px rgba(0, 0, 0, 0.2);

    .top {
      display: flex;
      justify-content: center;
      /* justify-content: space-between; */
      line-height: 45px;
      .date {
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
      margin: 1px 0;
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
        background: linear-gradient(
          90deg,
          rgba(250, 170, 70, 1) 0%,
          rgba(250, 100, 17, 1) 100%
        );
      }
    }
  }
}
</style>