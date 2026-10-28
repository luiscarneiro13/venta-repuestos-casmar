import { reactive } from 'vue'

export const uiState = reactive({
  sidebarCollapsed: true
})

export function toggleSidebar() {
  uiState.sidebarCollapsed = !uiState.sidebarCollapsed
}
