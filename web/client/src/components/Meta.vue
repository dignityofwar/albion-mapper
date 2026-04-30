<script setup lang="ts">
import { useHead } from '@vueuse/head';

useHead({
  title: 'Albion Roads Mapper',
  meta: [
    { name: 'description', content: 'Albion Roads Mapper - Easily map and track Albion Online roads.' },
    { property: 'og:title', content: 'Albion Roads Mapper' },
    { property: 'og:description', content: 'Albion Roads Mapper - Easily map and track Albion Online roads.' },
    { property: 'og:type', content: 'website' },
    { property: 'og:image', content: 'https://roadmap.dignityofwar.com/share.jpg' },
    { property: 'og:image:width', content: '1200' },
    { property: 'og:image:height', content: '630' },
    { property: 'og:image:type', content: 'image/jpeg' },
    { name: 'twitter:card', content: 'summary_large_image' },
    { name: 'twitter:image', content: 'https://roadmap.dignityofwar.com/share.png' },
    { name: 'msapplication-TileColor', content: '#373737' },
    { name: 'msapplication-TileImage', content: '/ms-icon-144x144.png' },
    { name: 'theme-color', content: '#373737FF' },
  ],
  link: [
    { rel: 'apple-touch-icon', sizes: '57x57', href: '/apple-icon-57x57.png' },
    { rel: 'apple-touch-icon', sizes: '60x60', href: '/apple-icon-60x60.png' },
    { rel: 'apple-touch-icon', sizes: '72x72', href: '/apple-icon-72x72.png' },
    { rel: 'apple-touch-icon', sizes: '76x76', href: '/apple-icon-76x76.png' },
    { rel: 'apple-touch-icon', sizes: '114x114', href: '/apple-icon-114x114.png' },
    { rel: 'apple-touch-icon', sizes: '120x120', href: '/apple-icon-120x120.png' },
    { rel: 'apple-touch-icon', sizes: '144x144', href: '/apple-icon-144x144.png' },
    { rel: 'apple-touch-icon', sizes: '152x152', href: '/apple-icon-152x152.png' },
    { rel: 'apple-touch-icon', sizes: '180x180', href: '/apple-icon-180x180.png' },
    { rel: 'icon', type: 'image/png', sizes: '192x192', href: '/android-icon-192x192.png' },
    { rel: 'icon', type: 'image/png', sizes: '32x32', href: '/favicon-32x32.png' },
    { rel: 'icon', type: 'image/png', sizes: '96x96', href: '/favicon-96x96.png' },
    { rel: 'icon', type: 'image/png', sizes: '16x16', href: '/favicon-16x16.png' },
    { rel: 'manifest', href: '/manifest.json' },
  ]
});
</script>

<template>
  <!-- No rendering -->
</template>
