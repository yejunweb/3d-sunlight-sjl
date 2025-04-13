import { defineStore } from 'pinia' 

export const tokenStore = defineStore('tokenStore', {  
  state: () => ({  
    token: ''  
  }),  
  actions: {  
    // 可以在这里定义修改状态的方法  
    setToken(newToken) {  
      this.token =  newToken// 直接修改状态  
    },  
  }  
})