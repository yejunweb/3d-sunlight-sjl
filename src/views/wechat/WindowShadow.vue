<template>
  <div class="window-shadow-container">
    <div class="title-bar">窗前光影结果图表展示</div>
    <div class="scrolly">
      <div class="chart-list">
        <div class="chart-high">
          <windowShadowRender v-if="showWindowShadowRender" :historyDetail="historyDetail"
            :windowData="sunshineWindowList" style="position:relative" />
        </div>
        <div class="chart-short">
          <div class="bar-item">
            <div ref="barChartRef" style="width: 90%; height: 100%;"></div>
          </div>
        </div>
        <div class="chart-middle">
          <div class="line-item">
            <div ref="lineChartRef" style="width: 90%; height: 100%;"></div>
          </div>
          <div class="date-picker-set">
            <p>当前展示范围开始时间：</p>
            <div class="date-picker">
              <p class="dummy-button">▼</p>
              <input type="date" v-model="startDate" @change="handleStartDateChange" :min="minDate"
                :max="selectMaxDate" />
            </div>
          </div>
          <div class="date-picker-set">
            <p>当前展示范围结束时间：</p>
            <div class="date-picker">
              <p class="dummy-button">▼</p>
              <input type="date" v-model="endDate" @change="handleEndDateChange" :min="selectMinDate" :max="maxDate" />
            </div>
          </div>
        </div>
        <div class="chart-middle">
          <div class="line-area">
            <div ref="lineAreaChartRef" style="width: 90%; height: 100%;"></div>
          </div>
          <div class="date-picker-set">
            <p>当前展示日期： </p>
            <div class="date-picker">
              <p class="dummy-button">▼</p>
              <input type="date" v-model="dateIndex" @change="handleDateChange" :min="minDate" :max="maxDate" />
            </div>
          </div>
          <div class="solar-terms">
            <van-button class="btn" :class="{ active: dateIndex === item.date }" plain size="mini" type="default"
              v-for="item in solarTerms" :key="item.date" @click="onSolarTermsChange(item.date)">{{ item.name
              }}</van-button>
          </div>
        </div>
      </div>
      <div class="submit-btn" v-if="isUserMatch">
        <button class="w-btn" type="button" :disabled="submitDisable" @click="submitParams">重新计算</button>
      </div>
    </div>
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
import * as echarts from 'echarts';
import { ref, onMounted, onUnmounted } from 'vue';
import windowShadowRender from './WindowShadowRender.vue'

import { getHistoryDetail, getSunshineWindowList, getDailyWindowSunShineArea, getMemberRechargeRecords } from '@/utils/api';
import { tokenStore } from '@/utils/stores';
import { useRoute } from 'vue-router';
import wx from "weixin-js-sdk";

export default {
  name: "WindowShadow",
  props: {
    msg: String,
  },

  components: {
    windowShadowRender
  },

  setup() {
    // 使用useRoute来获取当前路由信息
    const route = useRoute();
    const historyId = route.query.historyId;
    const loginUserId = route.query.loginUserId;
    let isUserMatch = ref(true);
    let submitDisable = ref(false);
    const currentDate = new Date();

    const isVip = ref(false);
    const isShowPayPopup = ref(false);
    const idleTimer = ref(null);

    let sunshineWindowList = ref(null);
    let historyDetail = ref(null);
    let dailyWindowSunShineArea = ref(null);
    let showWindowShadowRender = ref(false);

    const barChartRef = ref(null);
    const lineChartRef = ref(null);
    const lineAreaChartRef = ref(null);

    // 初始化日期相关变量
    const initDateVariables = () => ({
      startDate: ref(`${currentDate.getFullYear()}-01-01`),
      endDate: ref(`${currentDate.getFullYear()}-12-31`),
      selectMinDate: ref(`${currentDate.getFullYear()}-01-01`),
      selectMaxDate: ref(`${currentDate.getFullYear()}-12-31`),
      minDate: ref(`${currentDate.getFullYear()}-01-01`),
      maxDate: ref(`${currentDate.getFullYear()}-12-31`),
      dateIndex: ref(currentDate.toISOString().split('T')[0]),
      solarTerms: [
        { name: '立春', date: currentDate.getFullYear() + '-02-04' },
        { name: '春分', date: currentDate.getFullYear() + '-03-20' },
        { name: '立夏', date: currentDate.getFullYear() + '-05-05' },
        { name: '夏至', date: currentDate.getFullYear() + '-06-21' },
        { name: '立秋', date: currentDate.getFullYear() + '-08-07' },
        { name: '秋分', date: currentDate.getFullYear() + '-09-22' },
        { name: '立冬', date: currentDate.getFullYear() + '-11-07' },
        { name: '冬至', date: currentDate.getFullYear() + '-12-21' }
      ]
    });
    const dateVariables = initDateVariables();

    // 数据获取函数
    const fetchSunshineWindowList = async (historyId) => {
      try {
        const response = await getSunshineWindowList(historyId);
        if (response.data.success) {
          sunshineWindowList.value = response.data.result;
          initBarChart();    // 确保数据已加载
          await fetchHistoryDetail(historyId);
        } else {
          console.error("Failed to load sunshine window list:", response.data.message);
        }
      } catch (error) {
        console.error("Failed to load sunshine window list:", error);
      }
    };

    const fetchHistoryDetail = async (historyId) => {
      try {
        const response = await getHistoryDetail(historyId);
        if (response.data.success) {
          historyDetail.value = response.data.result;
          if (loginUserId != historyDetail.value.userId) {
            isUserMatch.value = false
          } else {
            isUserMatch.value = true
          }
          initLineChart();
          await fetchDailyWindowSunShineArea(historyId, dateVariables.dateIndex.value);
        } else {
          console.error("Failed to load history detail:", response.data.message);
        }
      } catch (error) {
        console.error("Error fetching history detail:", error);
      }
    };

    const fetchDailyWindowSunShineArea = async (historyId, dateStr) => {
      try {
        const response = await getDailyWindowSunShineArea(historyId, dateStr.substring(5, 10));
        if (response.data.success) {
          dailyWindowSunShineArea.value = response.data.result;
          initLineAreaChart();
          showWindowShadowRender.value = true;
        } else {
          console.error("Failed to load daily window sunshine area:", response.data.message);
        }
      } catch (error) {
        console.error("Error fetching daily window sunshine area:", error);
      }
    };


    // 初始化柱状图
    const initBarChart = () => {
      // 初始化图表实例
      var myChartBar = echarts.init(barChartRef.value);

      myChartBar.setOption({
        title: {
          text: '月平均单日光影总面积',
          subtext: `单位：m²，年份：${currentDate.getFullYear()}`
        },
        tooltip: {
          trigger: 'axis',
          confine: true,
          axisPointer: {    // 坐标轴指示器，坐标轴触发有效
            type: 'shadow'    // 默认为直线，可选为：'line' | 'shadow'
          }
        },
        grid: {
          top: '25%',
          left: '1%',
          right: '1%',
          bottom: '2%',
          containLabel: true
        },
        xAxis: [{
          type: 'category',
          axisTick: {
            alignWithLabel: true
          },
          data: ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'],
          axisLabel: {
            rotate: 45
          }
        }],
        yAxis: [{
          type: 'value'
        }],
        series: [{
          name: '平均单日光影总面积',
          type: 'bar',
          barGap: 0,
          itemStyle: {
            color: 'rgb(250, 170, 70)'
          },
          emphasis: {
            focus: 'series'
          },
          data: sunshineWindowList.value.monthlyAvgDailySunlightAreaAnnual.split(',').map((value, index) => {
            return index < 12 ? value : null; // 确保数据长度与月份相匹配
          })
        }]
      });
    };

    // 初始化曲线图
    const initLineChart = () => {
      // 初始化图表实例
      var myChartLine = echarts.init(lineChartRef.value);

      // 准备数据
      let dates = [];
      let dataValues = [];
      let startIndex = getDayOfYear(dateVariables.startDate.value) - 1;
      let endIndex = getDayOfYear(dateVariables.endDate.value) - 1;
      let areaList = sunshineWindowList.value.dailySunlightAreaTotalAnnual.split(',');

      // 填充数据
      for (let i = startIndex; i <= endIndex; i++) {
        dates.push(historyDetail.value.resultDetails[i].dateStr);
        dataValues.push(areaList[i]);
      }

      // 设置图表选项
      myChartLine.setOption({
        title: [{
          text: '年统计每日光影总面积',
          subtext: `单位：m²，年份：${currentDate.getFullYear()}`
        }],
        tooltip: {
          show: true,
          trigger: 'axis',
          confine: true
        },
        grid: {
          top: '25%',
          left: '1%',
          right: '1%',
          bottom: '5%',
          containLabel: true
        },
        xAxis: [{
          type: 'category',
          axisTick: {
            alignWithLabel: true
          },
          data: dates,
          axisLabel: {
            rotate: 45
          }
        }],
        yAxis: [{
          type: 'value'
        }],
        series: [{
          name: '光影总面积',
          type: 'line',
          smooth: false,
          showSymbol: false,
          itemStyle: {
            color: 'rgb(250, 170, 70)'
          },
          data: dataValues
        }]
      });
    };

    // 初始化曲线面积图
    const initLineAreaChart = () => {
      // 初始化图表实例
      var myChartLineArea = echarts.init(lineAreaChartRef.value);

      // 准备数据
      let specificTimes = [];
      let dataValuesForSpecificTimes = [];
      for (let i = 0; i < dailyWindowSunShineArea.value.length; i++) {
        specificTimes.push(dailyWindowSunShineArea.value[i].time.substring(0, 5));
        dataValuesForSpecificTimes.push(dailyWindowSunShineArea.value[i].area);
      }

      // 生成时间数组
      let timeArray = [];
      for (let i = 0; i < 24; i++) {
        for (let j = 0; j < 60; j++) {
          let hours = i < 10 ? '0' + i : i;
          let minutes = j < 10 ? '0' + j : j;
          timeArray.push(hours + ':' + minutes);
        }
      }
      timeArray.pop();    // 移除最后一个空字符串

      // 初始化数据值数组
      const dataValues = new Array(timeArray.length).fill(null);

      // 为指定的时间点设置数据值
      specificTimes.forEach((time, index) => {
        let indexInTimeArray = timeArray.indexOf(time);
        if (indexInTimeArray !== -1) {
          dataValues[indexInTimeArray] = dataValuesForSpecificTimes[index];
        }
      });

      myChartLineArea.setOption({
        title: [{
          text: '单日光影面积时间分布',
          subtext: `单位：m²，年份：${currentDate.getFullYear()}`
        }],
        tooltip: {
          show: true,
          trigger: 'axis',
          confine: true,
          position: function (pt) {
            return [pt[0], '10%'];
          }
        },
        grid: {
          top: '25%',
          left: '1%',
          right: '1%',
          bottom: '2%',
          containLabel: true
        },
        toolbox: {
          feature: {
            dataZoom: {
              yAxisIndex: 'none',
              title: { zoom: '区域缩放', back: '区域缩放还原' }
            },
            restore: { title: '还原' }
          }
        },
        xAxis: {
          type: 'category',
          boundaryGap: false,
          data: timeArray,
          axisLabel: {
            rotate: 45
          }
        },
        yAxis: {
          type: 'value'
        },
        series: [{
          name: '光影面积',
          type: 'line',
          symbol: 'none',
          itemStyle: {
            color: 'rgb(250, 170, 70)'
          },
          areaStyle: {
            color: 'rgb(250, 170, 71)'
          },
          data: dataValues
        }]
      });
    };

    // 初始化图表
    const init = () => {
      document.title = "采光分析大师";
      const token = route.query.token;
      const store = tokenStore();
      store.setToken(token);
      fetchSunshineWindowList(historyId);
    };

    // 其他辅助函数
    const getDayOfYear = (dateString) => {
      const inputDate = new Date(dateString);
      const year = inputDate.getFullYear();

      // 创建该年第一天（1月1日）的日期对象
      const firstDayOfYear = new Date(year, 0, 1);

      // 计算输入日期与年初的差值（毫秒数）
      const timeDifference = inputDate - firstDayOfYear;

      // 将毫秒数转换为天数
      const dayOfYear = Math.ceil(timeDifference / (1000 * 60 * 60 * 24));

      return dayOfYear;
    }

    const resetIdleTimer = () => {
      if (!isVip.value) {
        if (idleTimer.value) {
          clearTimeout(idleTimer.value);
        }
        idleTimer.value = setTimeout(() => {
          showPay();
        }, 5000);
      }
    }

    // 事件处理函数
    const handleStartDateChange = (event) => {
      const selectedDate = event.target.value;
      if (!selectedDate) {
        dateVariables.startDate.value = dateVariables.minDate.value;
      }

      const checkMinDate = new Date(dateVariables.startDate.value);
      checkMinDate.setDate(checkMinDate.getDate() + 1);
      dateVariables.selectMinDate.value = checkMinDate.toISOString().split('T')[0];
      initLineChart();
    };

    const handleEndDateChange = (event) => {
      const selectedDate = event.target.value;
      if (!selectedDate) {
        dateVariables.endDate.value = dateVariables.maxDate.value;
      }

      const checkMaxDate = new Date(dateVariables.endDate.value);
      checkMaxDate.setDate(checkMaxDate.getDate() - 1);
      dateVariables.selectMaxDate.value = checkMaxDate.toISOString().split('T')[0];
      initLineChart();
    };

    const handleDateChange = (event) => {
      const newDate = event.target.value;
      if (!newDate) {
        dateVariables.dateIndex.value = currentDate.toISOString().split('T')[0];
      }
      fetchDailyWindowSunShineArea(historyId, dateVariables.dateIndex.value)
    };

    const onSolarTermsChange = (dateStr) => {
      dateVariables.dateIndex.value = dateStr;
      fetchDailyWindowSunShineArea(historyId, dateVariables.dateIndex.value)
    };

    const submitParams = () => {
      wx.miniProgram.navigateTo({
        url: '../windowShadow/setWindowData?historyId=' + historyId
      });
    };

    const showPay = () => {
      isShowPayPopup.value = true;
    };

    const popupCancel = () => {
      isShowPayPopup.value = false;
      // 用户点击了“取消”，不执行跳转
      console.log("开通会员跳转被取消");

      resetIdleTimer();
    };

    const popupConfirm = () => {
      isShowPayPopup.value = false;
      // 用户点击了“确定”，执行跳转
      wx.miniProgram.navigateTo({
        url: '../../../exchange/exchange?historyId=' + historyId
      });

      resetIdleTimer();
    };

    onMounted(() => {
      getMemberRechargeRecords().then((memberRes) => {
        console.log("memberRes:", memberRes);
        if (memberRes.data.success && memberRes.data.result.id) {
          isVip.value = true;
        }

        resetIdleTimer();
      })

      init();
    });

    onUnmounted(() => {
      if (idleTimer.value) {
        clearTimeout(idleTimer.value);
      }
    });

    return {
      isUserMatch,
      submitDisable,

      isVip,
      isShowPayPopup,
      idleTimer,

      historyDetail,
      sunshineWindowList,
      showWindowShadowRender,

      barChartRef,
      lineChartRef,
      lineAreaChartRef,

      ...dateVariables,

      // 事件
      handleStartDateChange,
      handleEndDateChange,
      handleDateChange,
      onSolarTermsChange,
      submitParams,
      showPay,
      popupCancel,
      popupConfirm,
    };
  }
};
</script>


<!-- Add "scoped" attribute to limit CSS to this component only -->
<style scoped lang="scss">
.window-shadow-container {
  background-color: #efefef;
}

.title-bar {
  height: 4vh;
  min-height: 20px; // 设置一个最小高度以避免在极小视口中显示不全
  position: relative;
  margin-bottom: 1vw;
  padding: 0 0 1vw 0;
  display: flex;
  justify-content: center;
  font-size: 22px;
  color: #000;
  background-color: white;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
}

.scrolly {
  width: 100vw;
  height: 95vh;
  overflow-y: auto;
}

.chart-list {
  width: 100vw;
  background-color: #efefef;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.chart-high {
  width: 94vw;
  height: 70vh;
  margin-top: 10px;
  // padding: 1vw 1vw;
  background-color: white;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.chart-middle {
  width: 94vw;
  height: 50vh;
  margin-top: 10px;
  border-radius: 25px;
  padding: 5vw 1vw;
  background-color: white;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.chart-short {
  width: 94vw;
  height: 40vh;
  margin-top: 10px;
  border-radius: 25px;
  padding: 5vw 1vw;
  background-color: white;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.bar-item {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.line-item {
  width: 100%;
  height: 75%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.line-area {
  width: 100%;
  height: 66%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.date-picker-set {
  width: 100%;
  height: 15%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.date-picker {
  padding: 1px 4px;
  border-radius: 5px;
  border: 1px solid rgb(250, 170, 70);
  background-color: rgba(250, 170, 71, 0.1);
  position: relative;
  width: 36vw;
  height: 6vw;
  display: flex;
  align-items: center; //* 垂直居中 */
  overflow: hidden; //* 隐藏超出容器的部分 */
}

.dummy-button {
  position: absolute;
  right: 2px;
  text-align: right;
  color: rgb(250, 170, 70, 1);
}

input[type="date"] {
  -webkit-appearance: none; // 移除或更改WebKit浏览器中元素的原生外观
  appearance: none; // 移除或更改所有浏览器中元素的原生外观
  position: absolute;
  left: 0px;
  width: 35vw;
  border: 0;
  padding: 1px 2px;
  background-color: rgba(250, 170, 71, 0);
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

.submit-btn {
  margin: 2vw 0 5vw;
}

.w-btn {
  width: 50vw;
  height: 10vw;
  display: inline-block;
  padding: 10px 15px;
  border-radius: 5px;
  border: none;
  cursor: pointer;
  font-size: 17px;
  font-weight: bold;
  color: #fff;
  background-color: #07c160;
  transition: background-color 0.3s ease;
  box-shadow: 0 4px 8px 0 rgba(0, 0, 0, 0.2), 0 6px 20px 0 rgba(0, 0, 0, 0.19);
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
