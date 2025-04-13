import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import { createPinia } from 'pinia' 
import { Calendar, Slider, Icon, Button } from 'vant'
import { Watermark,Empty } from 'ant-design-vue';
import 'vant/lib/index.css'
import './styles/index.css'

const pinia = createPinia()
createApp(App)
.use(router)
.use(pinia)
.use(Calendar)
.use(Slider)
.use(Icon)
.use(Button)
.use(Watermark)
.use(Empty)
.mount('#app')

window.pinia = pinia