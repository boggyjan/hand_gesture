import { createApp } from 'vue'
import main from '~/components/main'

document.addEventListener('DOMContentLoaded', () => {
  const app = createApp(main)
  app.mount('#app')
})
