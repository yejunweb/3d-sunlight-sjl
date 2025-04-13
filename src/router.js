import { createRouter, createWebHashHistory } from 'vue-router'
import HouseLight from './views/wechat/HouseLight.vue'
import WindowShadow from './views/wechat/WindowShadow.vue'
import HouseLightResidential from './views/sunlight/HouseLightResidential.vue'
import BuildingDistance from './views/distance/BuildingDistance.vue'
import Residential from './views/building/Residential.vue'
import fieldView from './views/fieldView/fieldView.vue'

const routes = [
  {
    path: '/residential/:code',
    name: 'building',
    component: Residential
  },
  {
    path: '/residential/sunshine/:code',
    name: 'sunshine',
    component: HouseLightResidential
  },
  {
    path: '/house',
    name: 'HouseLight',
    component: HouseLight
  },
  {
    path: '/window',
    name: 'WindowShadow',
    component: WindowShadow
  },
  {
    path: '/residential/distance/:code',
    name: 'Distance',
    component: BuildingDistance
  },
  {
    path: '/residential/field/:code',
    name: 'fieldView',
    component: fieldView
  }
]
 
const router = createRouter({
  history: createWebHashHistory(),
  routes
})
 
export default router
