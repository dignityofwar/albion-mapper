<script setup lang="ts">
import { RouterView } from 'vue-router';
import { Analytics } from '@vercel/analytics/vue';
</script>

<template>
  <Analytics />
  <RouterView />
</template>
