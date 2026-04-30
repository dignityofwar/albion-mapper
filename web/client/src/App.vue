<script setup lang="ts">
import { RouterView } from 'vue-router';
import { Analytics } from '@vercel/analytics/vue';
import Meta from './components/Meta.vue';

const isProd = import.meta.env.PROD;
</script>

<template>
  <Meta />
  <Analytics v-if="isProd" />
  <RouterView />
</template>
