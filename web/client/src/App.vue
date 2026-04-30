<script setup lang="ts">
import { RouterView } from 'vue-router';
import { Analytics } from '@vercel/analytics/vue';

const isProd = import.meta.env.PROD;
</script>

<template>
  <Analytics v-if="isProd" />
  <RouterView />
</template>
