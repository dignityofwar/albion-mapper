import { defineStore } from 'pinia';
import { ref } from 'vue';

export const useTutorialStore = defineStore('tutorial', () => {
  const completed = ref(localStorage.getItem('CompletedTutorial') === 'true');
  const step = ref(parseInt(localStorage.getItem('TutorialStep') || '0', 10));
  const lastAddedNodeId = ref(localStorage.getItem('LastAddedNodeId') || '');

  function setCompleted(val: boolean) {
    completed.value = val;
    localStorage.setItem('CompletedTutorial', val.toString());
  }

  function setStep(val: number) {
    step.value = val;
    localStorage.setItem('TutorialStep', val.toString());
    console.log(`Tutorial step: ${val}`);
  }

  function setLastAddedNodeId(id: string) {
    lastAddedNodeId.value = id;
    localStorage.setItem('LastAddedNodeId', id);
  }

  return { completed, step, setCompleted, setStep, lastAddedNodeId, setLastAddedNodeId };
});
