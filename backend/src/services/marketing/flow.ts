import { MarketingAutomationStepType } from '@prisma/client';

type FlowNode = {
  id: string;
  type?: string;
  data?: Record<string, any>;
};

type FlowEdge = {
  id?: string;
  source: string;
  target: string;
};

export type FlowValidationError = { nodeId?: string; message: string };

function normalizeDelay(data?: Record<string, any>) {
  if (!data) return 0;
  if (Number.isFinite(data.delayMinutes)) return Math.max(0, Math.floor(Number(data.delayMinutes)));
  const amount = Number(data.delayAmount || 0);
  const unit = String(data.delayUnit || 'minutes');
  const multiplier = unit === 'days' ? 1440 : unit === 'hours' ? 60 : 1;
  return Math.max(0, Math.floor(amount * multiplier));
}

export function validateFlow(nodes: FlowNode[], edges: FlowEdge[]): FlowValidationError[] {
  const errors: FlowValidationError[] = [];
  const trigger = nodes.find((node) => node.type === 'trigger');
  if (!trigger) {
    errors.push({ message: 'Trigger node is required.' });
  }

  const nodeMap = new Map(nodes.map((node) => [node.id, node]));
  const incomingCount = new Map<string, number>();
  for (const edge of edges) {
    incomingCount.set(edge.target, (incomingCount.get(edge.target) || 0) + 1);
  }

  for (const node of nodes) {
    if (node.type === 'trigger') continue;
    if (!incomingCount.get(node.id)) {
      errors.push({ nodeId: node.id, message: 'Node is not connected to the flow.' });
    }
    if (node.type === 'sendEmail') {
      const templateId = node.data?.templateId;
      if (!templateId) {
        errors.push({ nodeId: node.id, message: 'Send Email nodes require a template.' });
      }
    }
    if (node.type === 'delay') {
      const delay = normalizeDelay(node.data);
      if (!Number.isFinite(delay) || delay < 0) {
        errors.push({ nodeId: node.id, message: 'Delay must be a valid number of minutes.' });
      }
    }
  }

  if (trigger) {
    const visited = new Set<string>();
    const queue = [trigger.id];
    while (queue.length) {
      const current = queue.shift();
      if (!current) continue;
      if (visited.has(current)) continue;
      visited.add(current);
      edges
        .filter((edge) => edge.source === current)
        .forEach((edge) => {
          if (nodeMap.has(edge.target)) queue.push(edge.target);
        });
    }
    for (const node of nodes) {
      if (!visited.has(node.id)) {
        errors.push({ nodeId: node.id, message: 'Node is unreachable from trigger.' });
      }
    }
  }

  return errors;
}

export function buildStepsFromFlow(nodes: FlowNode[], edges: FlowEdge[]) {
  const trigger = nodes.find((node) => node.type === 'trigger');
  if (!trigger) return [];

  const nodeMap = new Map(nodes.map((node) => [node.id, node]));
  const adjacency = new Map<string, string[]>();
  edges.forEach((edge) => {
    if (!adjacency.has(edge.source)) adjacency.set(edge.source, []);
    adjacency.get(edge.source)?.push(edge.target);
  });

  const visited = new Set<string>();
  const steps: Array<{
    stepType: MarketingAutomationStepType;
    delayMinutes: number;
    templateId: string | null;
    conditionRules: any;
    stepConfig: any;
    throttleMinutes: number;
    quietHoursStart: number | null;
    quietHoursEnd: number | null;
    stepOrder: number;
  }> = [];

  const queue = [trigger.id];
  while (queue.length) {
    const currentId = queue.shift();
    if (!currentId || visited.has(currentId)) continue;
    visited.add(currentId);

    const node = nodeMap.get(currentId);
    if (!node) continue;

    if (node.type && node.type !== 'trigger') {
      const data = node.data || {};
      let stepType: MarketingAutomationStepType = MarketingAutomationStepType.SEND_EMAIL;
      let delayMinutes = 0;
      let templateId: string | null = null;
      let conditionRules: any = null;
      let stepConfig: any = null;
      let throttleMinutes = 0;
      let quietHoursStart: number | null = null;
      let quietHoursEnd: number | null = null;

      switch (node.type) {
        case 'delay':
          stepType = MarketingAutomationStepType.WAIT;
          delayMinutes = normalizeDelay(data);
          break;
        case 'branch':
          stepType = MarketingAutomationStepType.BRANCH;
          conditionRules = data.conditions || null;
          stepConfig = { branchConditions: data.conditions || [] };
          break;
        case 'tag':
          stepType = MarketingAutomationStepType.ADD_TAG;
          stepConfig = { action: data.action || 'ADD', tagName: data.tagName || null };
          break;
        case 'notify':
          stepType = MarketingAutomationStepType.NOTIFY_ORGANISER;
          stepConfig = { message: data.message || null };
          break;
        case 'stop':
          stepType = MarketingAutomationStepType.WAIT;
          delayMinutes = 0;
          stepConfig = { stop: true };
          break;
        case 'sendEmail':
        default:
          stepType = MarketingAutomationStepType.SEND_EMAIL;
          templateId = data.templateId || null;
          throttleMinutes = Number(data.throttleMinutes || 0) || 0;
          quietHoursStart = data.quietHoursStart ?? null;
          quietHoursEnd = data.quietHoursEnd ?? null;
          break;
      }

      steps.push({
        stepType,
        delayMinutes,
        templateId,
        conditionRules,
        stepConfig,
        throttleMinutes,
        quietHoursStart,
        quietHoursEnd,
        stepOrder: steps.length + 1,
      });
    }

    const nextNodes = adjacency.get(currentId) || [];
    nextNodes.forEach((next) => queue.push(next));
  }

  return steps;
}
