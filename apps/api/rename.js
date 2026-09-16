import * as fs from 'fs';
import * as path from 'path';

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walkDir(dirPath, callback) : callback(path.join(dir, f));
  });
}

function replaceInFile(filePath) {
  if (!filePath.endsWith('.ts')) return;
  let content = fs.readFileSync(filePath, 'utf8');
  let original = content;
  
  // Replace Sprint -> Iteration
  content = content.replace(/SprintsController/g, 'IterationsController');
  content = content.replace(/SprintsService/g, 'IterationsService');
  content = content.replace(/SprintsRepository/g, 'IterationsRepository');
  content = content.replace(/SprintsModule/g, 'IterationsModule');
  content = content.replace(/CreateSprintDto/g, 'CreateIterationDto');
  content = content.replace(/UpdateSprintDto/g, 'UpdateIterationDto');
  content = content.replace(/createSprintSchema/g, 'createIterationSchema');
  
  // Variables
  content = content.replace(/sprintId/g, 'iterationId');
  content = content.replace(/sprint_id/g, 'iteration_id');
  content = content.replace(/activeSprint/g, 'activeIteration');
  content = content.replace(/sprintItems/g, 'iterationItems');
  content = content.replace(/sprintsService/g, 'iterationsService');
  content = content.replace(/sprintsRepository/g, 'iterationsRepository');
  
  // Strings/paths
  content = content.replace(/'sprints'/g, "'iterations'");
  content = content.replace(/'sprint'/g, "'iteration'");
  content = content.replace(/\/sprints/g, '/iterations');
  content = content.replace(/sprint_history/g, 'iteration_history');
  content = content.replace(/sprints\.module/g, 'iterations.module');
  content = content.replace(/sprints\.controller/g, 'iterations.controller');
  content = content.replace(/sprints\.service/g, 'iterations.service');
  content = content.replace(/sprints\.repository/g, 'iterations.repository');
  content = content.replace(/sprints\.dto/g, 'iterations.dto');

  // Any remaining lowercase sprints
  // Warning: be careful with these.
  content = content.replace(/\bsprints\b/g, 'iterations');
  content = content.replace(/\bsprint\b/g, 'iteration');
  content = content.replace(/\bSprint\b/g, 'Iteration');
  content = content.replace(/\bSprints\b/g, 'Iterations');

  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('Updated: ' + filePath);
  }
}

walkDir('/home/suraj/Documents/playground/todo-app/apps/api/src', replaceInFile);
