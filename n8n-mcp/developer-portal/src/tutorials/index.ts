import { Tutorial } from '../components/InteractiveTutorial/TutorialEngine';
import { gettingStartedTutorial } from './getting-started';
import { advancedWorkflowsTutorial } from './advanced-workflows';

export const tutorials: Tutorial[] = [
  gettingStartedTutorial,
  advancedWorkflowsTutorial
];

export const getTutorialById = (id: string): Tutorial | undefined => {
  return tutorials.find(tutorial => tutorial.id === id);
};

export const getTutorialsByDifficulty = (difficulty: string): Tutorial[] => {
  return tutorials.filter(tutorial => tutorial.difficulty === difficulty);
};

export const getTutorialsByTag = (tag: string): Tutorial[] => {
  return tutorials.filter(tutorial => tutorial.tags.includes(tag));
};