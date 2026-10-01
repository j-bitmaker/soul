import type { GoalMap, GoalNode } from './types'

const understand = [
  ['theology-scripture', 'Theology / Scripture'],
  ['launch-blog', 'Launch Blog'],
  ['english-c1', 'English C1'],
  ['clear-speech-writing', 'Clear speech / writing'],
  ['philosophy-humanities', 'Philosophy / humanities'],
] as const

const create = [
  ['professional-autonomy', 'Professional autonomy'],
  ['software-ai', 'Software / AI Engineering'],
  ['own-products', 'Own products'],
  ['stable-income-capital', 'Stable income / capital'],
  ['material-autonomy', 'Material / geographic / legal autonomy'],
] as const

const mastery = [
  ['attention-focus', 'Attention / focus'],
  ['developing-skills', 'Skills currently developing'],
  ['planning-organisation', 'Planning / organisation'],
  ['cognitive-condition', 'Cognitive condition'],
  ['habits-self-control', 'Habits / self-control'],
] as const

function node(id: string, title: string, parentId: string | null, childrenIds: string[] = []): GoalNode {
  return { id, title, parentId, childrenIds, visibleChildIds: [...childrenIds], secondaryIds: [] }
}

function goalEntries(parentId: string, goals: readonly (readonly [string, string])[]): Record<string, GoalNode> {
  return Object.fromEntries(goals.map(([id, title]) => [id, node(id, title, parentId)]))
}

export function createSeedMap(): GoalMap {
  const nodes: Record<string, GoalNode> = {
    soul: {
      ...node('soul', 'Soul', null, ['understand', 'create', 'mastery']),
      description: 'Unity with God. Life in the Holy Spirit, truth and conscience.',
    },
    understand: { ...node('understand', 'Understand & Express', 'soul', understand.map(([id]) => id)),
      description: 'Understand truth, form your own understanding, and express it clearly.',
      labels: [{ id: 'read-bible', text: 'Read Bible · Daily' }] },
    create: { ...node('create', 'Practical Agency', 'soul', create.map(([id]) => id)),
      description: 'Create useful things, sustain yourself, and preserve freedom of choice.' },
    mastery: { ...node('mastery', 'Self-Mastery', 'soul', mastery.map(([id]) => id)),
      description: 'Care for attention, energy, habits, and ways of working.' },
    ...goalEntries('understand', understand),
    ...goalEntries('create', create),
    ...goalEntries('mastery', mastery),
  }

  nodes['english-c1'] = {
    ...nodes['english-c1'], current: 'B2-ish', target: 'C1',
    milestones: [{ id: 'fluent-conversation', title: 'Discuss complex topics fluently', done: false }],
    reminders: ['Speaking practice', 'Writing', 'Grammar', 'Reading'],
    secondaryIds: ['create'],
  }
  nodes['launch-blog'] = {
    ...nodes['launch-blog'],
    milestones: [
      { id: 'blog-concept', title: 'Find the initial concept', done: true },
      { id: 'blog-launch', title: 'Publish the first working version', done: false },
      { id: 'blog-rhythm', title: 'Establish regular publication', done: false },
    ],
    reminders: ['Choose the first topic', 'Publish the first piece'],
    note: 'Start with something personally interesting; do not optimize for audience before publishing.',
  }
  nodes['professional-autonomy'] = {
    ...nodes['professional-autonomy'],
    target: 'A stable professional and economic position for the next several years.',
  }

  return {
    schemaVersion: 1,
    revision: 0,
    nodes,
    frontier: [
      { nodeId: 'professional-autonomy', status: 'active' },
      { nodeId: 'launch-blog', status: 'active' },
      { nodeId: 'english-c1', status: 'active' },
      { nodeId: 'theology-scripture', status: 'queued' },
      { nodeId: 'software-ai', status: 'queued' },
    ],
  }
}
