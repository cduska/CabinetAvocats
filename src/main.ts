import { createApp } from 'vue'
import './style.css'
import App from './App.vue'
import router from './router'
import { bootstrapNeonAuthToken } from './services/api/utils'

void bootstrapNeonAuthToken()

createApp(App).use(router).mount('#app')
