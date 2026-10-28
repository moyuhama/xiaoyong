<script setup lang="ts">
import Icon from "./Icon.vue";
import type { Tool } from "../lib/tools";
defineProps<{ tool: Tool; compact?: boolean }>();
defineEmits<{ open: [id: string] }>();
</script>
<template>
  <a
    :href="'#/tool/' + tool.id"
    class="catalog-card"
    :class="{ compact }"
    @click.prevent="$emit('open', tool.id)"
  >
    <span class="tool-icon" :class="tool.color"
      ><Icon :name="tool.icon" :size="21"
    /></span>
    <span class="catalog-card-copy"
      ><strong>{{ tool.name }}</strong
      ><span v-if="!compact">{{ tool.description }}</span></span
    >
    <Icon class="catalog-card-arrow" name="ChevronRight" :size="16" />
  </a>
</template>
