import { createRouter, createWebHistory } from 'vue-router';
import LandingPage from '../views/LandingPage.vue';
import RoomView from '../views/RoomView.vue';

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', component: LandingPage },
    { path: '/rooms/:id', component: RoomView, props: true },
  ],
});
