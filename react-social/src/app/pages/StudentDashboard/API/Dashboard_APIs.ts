import axios from "axios";

const API_BASE_URL = process.env.REACT_APP_API_URL || "http://localhost:8080";

// ========== TYPE DEFINITIONS ==========

export interface StudentInfo {
  userStudentId: number;
  name: string;
  grade?: string;
  schoolBoard?: string;
  familyType?: string;
  siblingsCount?: number;
  assessmentDate?: string;
  schoolName?: string;
  schoolLogo?: string;
}

export interface AttentionData {
  dPrimeScore: number;
  category: string;
  hits: number;
  misses: number;
  falsePositives: number;
  interpretation: string;
  actionTip: string;
}

export interface WorkingMemoryData {
  levelReached: number;
  rawScore: number;
  category: string;
  pathwaysCompleted: number;
  interpretation: string;
  actionTip: string;
}

export interface CognitiveFlexibilityData {
  style: string;
  time: number;
  aimlessClicks: number;
  puzzlesCompleted: number;
  curiousClicks: number;
  interpretation: string;
  actionTip: string;
}

export interface CognitiveData {
  attention?: AttentionData;
  workingMemory?: WorkingMemoryData;
  cognitiveFlexibility?: CognitiveFlexibilityData;
}

export interface TopDomain {
  name: string;
  score: number;
}

export interface SocialInsightData {
  score: number;
  category: string;
  awarenessLevel: string;
  categoryTitle: string;
  interpretation: string;
  detailedInterpretation: string;
  traits?: string[];
  topDomains?: TopDomain[];
  growthAreas?: TopDomain[];
}

export interface ValueData {
  name: string;
  phrase: string;
  meaning: string;
  rank: number;
}

export interface EnvironmentalAwarenessData {
  netScore: number;
  category: string;
  icon: string;
  friendlyChoices: number;
  unfriendlyChoices: number;
  interpretation: string;
}

export interface SocialData {
  socialInsight?: SocialInsightData;
  values?: ValueData[];
  environmentalAwareness?: EnvironmentalAwarenessData;
}

export interface SelfEfficacyData {
  rawScore: number;
  minScore: number;
  maxScore: number;
  level: string;
  interpretation: string;
}

export interface EmotionalRegulationData {
  rawScore: number;
  minScore: number;
  maxScore: number;
  level: string;
  interpretation: string;
}

export interface SelfRegulationData {
  rawScore: number;
  minScore: number;
  maxScore: number;
  level: string;
  interpretation: string;
}

export interface SelfManagementData {
  selfEfficacy?: SelfEfficacyData;
  emotionalRegulation?: EmotionalRegulationData;
  selfRegulation?: SelfRegulationData;
}

export interface DashboardData {
  student: StudentInfo;
  cognitive: CognitiveData;
  social: SocialData;
  selfManagement: SelfManagementData;
}

// ========== RAW DASHBOARD API RESPONSE TYPES ==========

export interface DashboardApiMQData {
  measuredQualityId: number;
  name: string;
  description: string;
  displayName: string;
}

export interface DashboardApiMQTData {
  measuredQualityTypeId: number;
  name: string;
  description: string;
  displayName: string;
  measuredQuality: DashboardApiMQData;
}

export interface DashboardApiMQTScore {
  scoreId: number;
  score: number;
  measuredQualityType: DashboardApiMQTData;
}

export interface DashboardApiOptionData {
  optionId: number;
  optionText: string | null;
  optionDescription: string | null;
  isCorrect: boolean;
  mqtScores: DashboardApiMQTScore[];
}

export interface DashboardApiAnswerDetail {
  assessmentAnswerId: number;
  questionnaireQuestionId: number;
  rankOrder: number | null;
  selectedOption: DashboardApiOptionData;
}

export interface DashboardApiRawScoreData {
  assessmentRawScoreId: number;
  rawScore: number;
  measuredQualityType: DashboardApiMQTData;
  measuredQuality: DashboardApiMQData;
}

export interface DashboardApiAssessmentData {
  assessmentId: number;
  assessmentName: string;
  status: string;
  isActive: boolean;
  startDate: string;
  endDate: string;
  studentAssessmentMappingId: number;
  questionnaireType: boolean | null;
  answers: DashboardApiAnswerDetail[];
  rawScores: DashboardApiRawScoreData[];
}

export interface DashboardApiStudentInfo {
  userStudentId: number;
  userId: number;
  instituteName: string;
  instituteCode: number;
}

export interface DashboardApiResponse {
  studentInfo: DashboardApiStudentInfo;
  assessments: DashboardApiAssessmentData[];
}

// ========== HELPER FUNCTIONS ==========

/**
 * Calculate d-prime score for attention
 */
function calculateDPrime(hits: number, totalTargets: number, falseAlarms: number, totalNonTargets: number): number {
  const hitRate = Math.max(0.01, Math.min(0.99, hits / totalTargets));
  const falseAlarmRate = Math.max(0.01, Math.min(0.99, falseAlarms / totalNonTargets));

  // Convert to z-scores (simplified approximation)
  const zHit = normalInverse(hitRate);
  const zFA = normalInverse(falseAlarmRate);

  return zHit - zFA;
}

/**
 * Simplified inverse normal distribution (for z-score calculation)
 */
function normalInverse(p: number): number {
  // Simplified approximation of inverse normal CDF
  const a1 = -39.6968302866538;
  const a2 = 220.946098424521;
  const a3 = -275.928510446969;
  const a4 = 138.357751867269;
  const a5 = -30.6647980661472;
  const a6 = 2.50662827745924;

  const b1 = -54.4760987982241;
  const b2 = 161.585836858041;
  const b3 = -155.698979859887;
  const b4 = 66.8013118877197;
  const b5 = -13.2806815528857;

  const c1 = -0.00778489400243029;
  const c2 = -0.322396458041136;
  const c3 = -2.40075827716184;
  const c4 = -2.54973253934373;
  const c5 = 4.37466414146497;
  const c6 = 2.93816398269878;

  const d1 = 0.00778469570904146;
  const d2 = 0.32246712907004;
  const d3 = 2.445134137143;
  const d4 = 3.75440866190742;

  const pLow = 0.02425;
  const pHigh = 1 - pLow;

  let q, r;

  if (p < pLow) {
    q = Math.sqrt(-2 * Math.log(p));
    return (((((c1 * q + c2) * q + c3) * q + c4) * q + c5) * q + c6) /
      ((((d1 * q + d2) * q + d3) * q + d4) * q + 1);
  } else if (p <= pHigh) {
    q = p - 0.5;
    r = q * q;
    return (((((a1 * r + a2) * r + a3) * r + a4) * r + a5) * r + a6) * q /
      (((((b1 * r + b2) * r + b3) * r + b4) * r + b5) * r + 1);
  } else {
    q = Math.sqrt(-2 * Math.log(1 - p));
    return -(((((c1 * q + c2) * q + c3) * q + c4) * q + c5) * q + c6) /
      ((((d1 * q + d2) * q + d3) * q + d4) * q + 1);
  }
}

/**
 * Get attention category based on d-prime score
 */
function getAttentionCategory(dPrime: number): string {
  if (dPrime >= 3.01) return "Vigilant";
  if (dPrime >= 1.51) return "Attentive";
  if (dPrime >= 0.51) return "Inconsistent";
  if (dPrime >= -0.50) return "Distracted";
  return "Detached";
}

/**
 * Get attention interpretation
 */
function getAttentionInterpretation(category: string): { interpretation: string; actionTip: string } {
  const interpretations: Record<string, { interpretation: string; actionTip: string }> = {
    "Vigilant": {
      interpretation: "You possess elite 'vigilance.' You filter distractions effortlessly and stay in a 'flow state' even during monotonous tasks.",
      actionTip: "Prevent boredom by seeking high-complexity tasks; your brain thrives on challenge."
    },
    "Attentive": {
      interpretation: "Your focus is strong and consistent. You can maintain attention well during most tasks.",
      actionTip: "Continue challenging yourself with engaging activities that require sustained concentration."
    },
    "Inconsistent": {
      interpretation: "Your focus comes in waves. You are generally 'on,' but experience brief 'attentional blinks' where your mind wanders.",
      actionTip: "Use the Pomodoro technique (25m work/5m break) to reset your attentional battery."
    },
    "Distracted": {
      interpretation: "You likely experienced 'cognitive fatigue.' Your brain defaulted to autopilot, leading to misses or impulsive clicks.",
      actionTip: "Use Active Engagement (like note-taking) to force your brain out of passive 'zoning out' modes."
    },
    "Detached": {
      interpretation: "Attention was significantly challenged during this task. This might indicate high distractibility or task disengagement.",
      actionTip: "Break tasks into smaller chunks and take frequent breaks. Consider environmental factors that might be affecting concentration."
    }
  };

  return interpretations[category] || interpretations["Distracted"];
}

/**
 * Get working memory category based on raw score (points out of 12)
 * High: 10-12 → Multifaceted, Moderate: 6-9 → Sequential, Low: 0-5 → Unitary
 */
function getWorkingMemoryCategory(rawScore: number): string {
  if (rawScore >= 10) return "Multifaceted";
  if (rawScore >= 6) return "Sequential";
  return "Unitary";
}

/**
 * Get working memory interpretation
 */
function getWorkingMemoryInterpretation(category: string): { interpretation: string; actionTip: string } {
  const interpretations: Record<string, { interpretation: string; actionTip: string }> = {
    "Multifaceted": {
      interpretation: "Can follow 3+ step complex instructions. Likely to excel in mental math, coding, and multi-perspective debating.",
      actionTip: "Challenge yourself with complex logic puzzles, coding, or advanced math. You're ready for multi-step projects!"
    },
    "Sequential": {
      interpretation: "Can follow 2-step instructions reliably. Benefits from 'chunking' information into manageable parts during new lessons.",
      actionTip: "Slow down the 'flip.' Write down tasks, then physically number them in order. Don't try to re-order things purely in your head."
    },
    "Unitary": {
      interpretation: "Needs instructions broken into single steps. Requires visual checklists, frequent repetition, and simplified language to prevent 'blanking out.'",
      actionTip: "Chunk it up. Ask teachers to give you instructions one step at a time. Focus on one sentence, finish it, then move to the next."
    }
  };

  return interpretations[category] || interpretations["Sequential"];
}

/**
 * Determine cognitive flexibility style
 */
function getCognitiveFlexibilityStyle(time: number, aimlessClicks: number): string {
  const fastTime = time < 90; // Less than 1.5 minutes
  const lowAimless = aimlessClicks < 3;

  if (fastTime && lowAimless) return "Efficient";
  if (fastTime && !lowAimless) return "Impatient";
  if (!fastTime && lowAimless) return "Methodical";
  return "Unsystematic";
}

/**
 * Get cognitive flexibility interpretation
 */
function getCognitiveFlexibilityInterpretation(style: string): { interpretation: string; actionTip: string } {
  const interpretations: Record<string, { interpretation: string; actionTip: string }> = {
    "Efficient": {
      interpretation: "High Mental Efficiency: Your child quickly visualizes the solution and executes it with precision. They have strong working memory.",
      actionTip: "Challenge Them: Provide multi-step projects like robotics, coding, or strategy games (Chess) that require long-term planning."
    },
    "Impatient": {
      interpretation: "Impulsive Agility: Your child has a quick mind but acts before a plan is formed. They rely on speed rather than strategy, leading to 'hurried' logic.",
      actionTip: "The 'Pause' Rule: Ask them to 'explain the first two moves' out loud before they touch the screen. This builds the habit of thinking before acting."
    },
    "Methodical": {
      interpretation: "Careful Accuracy: Your child prioritizes being 'correct' over 'fast.' They are internalizing the logic and double-checking their mental map.",
      actionTip: "Build Fluency: Use timed 'fun' challenges with low stakes (like 'Beat the Clock' math) to reduce perfectionism and build confidence in quick thinking."
    },
    "Unsystematic": {
      interpretation: "Trial-and-Error Learning: Your child is highly persistent but may be feeling overwhelmed. They use physical action (tapping) to solve what they can't yet visualize.",
      actionTip: "Visual Mapping: Teach them to 'scratchpad' a problem. Drawing out the puzzle on paper helps move thinking from impulsive tapping to visual planning."
    }
  };

  return interpretations[style] || interpretations["Methodical"];
}

/**
 * Get comprehensive social insight data based on score.
 * Score ranges: 0-6 (Low), 7-12 (Moderate), 13-18 (High)
 */
function getSocialInsightFullData(score: number): {
  category: string;
  awarenessLevel: string;
  categoryTitle: string;
  interpretation: string;
  detailedInterpretation: string;
  traits: string[];
} {
  if (score >= 13) {
    return {
      category: "Mind-Reading",
      awarenessLevel: "High Awareness",
      categoryTitle: "The Mind Reader",
      interpretation: "Your child possesses advanced socio-cognitive maturity, tracking multiple layers of thought simultaneously and navigating complex social hierarchies with high emotional intelligence.",
      detailedInterpretation: "This score reflects advanced socio-cognitive maturity. These children excel at \"mentalizing\"\u2014tracking multiple layers of thought simultaneously. They are particularly adept at recognizing Indirect Speech Acts, an essential skill in Indian culture where respect for elders often involves responding to subtle hints. They can distinguish between a speaker\u2019s literal words and their strategic goal, allowing them to navigate complex social hierarchies and peer groups with high emotional intelligence. This level of maturity often leads to strong leadership potential and deep, empathetic connections with others.",
      traits: [
        "Mind-Reading: tracks layers of thoughts easily",
        "Hint-Expert: understands subtle commands and hints",
        "Strategic: can see through \"double bluffs\" and tricks",
      ],
    };
  } else if (score >= 7) {
    return {
      category: "Clue-Spotter",
      awarenessLevel: "Moderate Awareness",
      categoryTitle: "The Social Detective",
      interpretation: "Your child shows healthy, age-appropriate development of social intuition and can accurately navigate most everyday social challenges.",
      detailedInterpretation: "Children in this range show healthy, age-appropriate development of social intuition. They have moved past basic perspective-taking and can accurately navigate most everyday social challenges. They understand that a teacher calling them by the wrong name is an accident and can tell when a friend is being sarcastic to vent frustration. While they are competent \"Social Detectives,\" they are still refining the higher-level logic required to understand complex deceptions or \"double-layered\" thoughts (thinking about what someone else thinks they are thinking).",
      traits: [
        "Clue-Spotter: usually tells when a friend is being funny",
        "Intent-Reader: knows mistakes are different from being mean",
        "Developing: may find complex bluffs tricky",
      ],
    };
  } else {
    return {
      category: "Fact-Focused",
      awarenessLevel: "Low Awareness",
      categoryTitle: "The Literal Thinker",
      interpretation: "Your child processes social information in a concrete and literal manner. This is a common developmental stage where they are building the skills needed to decouple a person\u2019s words from their actual intent.",
      detailedInterpretation: "Participants in this range process social information in a concrete and literal manner. In the Indian social context\u2014where politeness and \"saving face\" often lead to indirect communication\u2014these children may find it difficult to identify \"white lies\" or subtle sarcasm. They primarily rely on literal definitions and may assume that if a person says something factually incorrect, they are simply \"wrong\" or \"lying.\" This is a common developmental stage where the child is still building the \"mental muscles\" needed to decouple a person\u2019s words from their actual intent.",
      traits: [
        "Fact-Focused: listens to exactly what is said",
        "Direct: prefers clear instructions over hints",
        "Intent: finds \"white lies\" or sarcasm confusing",
      ],
    };
  }
}

/**
 * Get environmental awareness category
 */
function getEnvironmentalCategory(netScore: number): { category: string; icon: string; interpretation: string } {
  if (netScore >= 2) {
    return {
      category: "Mighty Tree",
      icon: "🌳",
      interpretation: "Your child consistently looks past the \"shiny\" stuff to choose what is best for the planet."
    };
  } else if (netScore >= 0) {
    return {
      category: "Growing Sapling",
      icon: "🌿",
      interpretation: "Your child is balancing convenience with caring for the planet in your daily life."
    };
  } else {
    return {
      category: "Seedling Starter",
      icon: "🌱",
      interpretation: "Your child currently prefers things that are quick and easy—try swapping one \"convenient\" choice for a \"green\" one this week!"
    };
  }
}

// ========== GAME RESULTS TYPES ==========

interface RawAnimalReaction {
  totalTrials?: number;
  trialMs?: number;
  target?: string;
  targetsShown?: number;
  hits?: number;
  misses?: number;
  falsePositives?: number;
  hitRTsMs?: number[];
  timestamp?: string;
}

interface RawRabbitPath {
  score?: number;
  totalRounds?: number;
  roundsPlayed?: number;
  history?: any[];
  timestamp?: string;
}

interface RawHydroTube {
  patternsCompleted?: number;
  totalPatterns?: number;
  aimlessRotations?: number;
  curiousClicks?: number;
  tilesCorrect?: number;
  totalTiles?: number;
  timeSpentSeconds?: number;
  timestamp?: string;
}

interface RawGameResults {
  userStudentId?: string;
  animal_reaction?: RawAnimalReaction;
  rabbit_path?: RawRabbitPath;
  hydro_tube?: RawHydroTube;
  lastUpdated?: string;
}

// ========== GAME RESULTS PROCESSING ==========

/**
 * Fetch game results from Firebase via backend.
 * Document ID in Firebase = userStudentId.
 */
export async function fetchGameResults(studentId: number): Promise<RawGameResults | null> {
  try {
    const response = await axios.get(`${API_BASE_URL}/game-results/get/${studentId}`);
    return response.data;
  } catch (error) {
    console.warn("Failed to fetch game results:", error);
    return null;
  }
}

/**
 * Process raw Firebase game results into CognitiveData for the dashboard.
 * Applies d-prime calculation, category classification, and interpretation.
 */
export function processGameResults(raw: RawGameResults): CognitiveData {
  const cognitive: CognitiveData = {};

  // --- ATTENTION (animal_reaction / Jungle Spot game) ---
  if (raw.animal_reaction) {
    const ar = raw.animal_reaction;
    const hits = ar.hits || 0;
    const totalTargets = ar.targetsShown || 24;
    const falsePositives = ar.falsePositives || 0;
    const totalNonTargets = (ar.totalTrials || 120) - totalTargets;

    const dPrime = calculateDPrime(hits, totalTargets, falsePositives, totalNonTargets);
    const category = getAttentionCategory(dPrime);
    const { interpretation, actionTip } = getAttentionInterpretation(category);

    cognitive.attention = {
      dPrimeScore: dPrime,
      category,
      hits,
      misses: ar.misses || 0,
      falsePositives,
      interpretation,
      actionTip,
    };
  }

  // --- WORKING MEMORY (rabbit_path / Rabbit's Path game) ---
  if (raw.rabbit_path) {
    const rp = raw.rabbit_path;
    const rawScore = rp.score || 0;
    // Derive highest difficulty level reached from score
    const levelReached = rawScore >= 10 ? 3 : rawScore >= 6 ? 2 : 1;
    const category = getWorkingMemoryCategory(rawScore);
    const { interpretation, actionTip } = getWorkingMemoryInterpretation(category);

    cognitive.workingMemory = {
      levelReached,
      rawScore,
      category,
      pathwaysCompleted: rp.roundsPlayed || 0,
      interpretation,
      actionTip,
    };
  }

  // --- COGNITIVE FLEXIBILITY (hydro_tube / Hydro Tube game) ---
  if (raw.hydro_tube) {
    const ht = raw.hydro_tube;
    const time = ht.timeSpentSeconds || 0;
    const aimlessClicks = ht.aimlessRotations || 0;
    const style = getCognitiveFlexibilityStyle(time, aimlessClicks);
    const { interpretation, actionTip } = getCognitiveFlexibilityInterpretation(style);

    cognitive.cognitiveFlexibility = {
      style,
      time,
      aimlessClicks,
      puzzlesCompleted: ht.patternsCompleted || 0,
      curiousClicks: ht.curiousClicks || 0,
      interpretation,
      actionTip,
    };
  }

  return cognitive;
}

// ========== API FUNCTIONS ==========

/**
 * Fetch student's assigned assessments with status
 */
export async function getStudentAssessments(studentId: number): Promise<any[]> {
  try {
    const response = await axios.get(`${API_BASE_URL}/assessments/student/${studentId}`);
    return response.data;
  } catch (error) {
    console.warn("Failed to fetch student assessments:", error);
    return [];
  }
}

/**
 * Fetch all assessment data from the single dashboard endpoint.
 * Returns the complete raw response with all assessments, answers, and raw scores.
 */
export async function fetchAllDashboardData(studentId: number): Promise<DashboardApiResponse | null> {
  try {
    const response = await axios.post(
      `${API_BASE_URL}/assessment-answer/dashboard`,
      { userStudentId: studentId },
      { headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' } }
    );
    return response.data;
  } catch (error) {
    console.error("Failed to fetch dashboard data from single endpoint:", error);
    return null;
  }
}

// ========== SELF-MANAGEMENT HELPERS ==========

/**
 * Get self-efficacy data based on raw score.
 * Score range: 11-22. Low: 11-14, Moderate: 15-18, High: 19-22.
 */
function getSelfEfficacyFullData(score: number): { level: string; interpretation: string } {
  if (score >= 19) {
    return {
      level: "High",
      interpretation:
        "Your child has a \u201ccan-do\u201d attitude, seeing mistakes as a natural part of learning and staying determined even when a task gets tough.",
    };
  } else if (score >= 15) {
    return {
      level: "Moderate",
      interpretation:
        "Your child feels confident with things they already know but might need a little extra encouragement to try something brand new or difficult.",
    };
  } else {
    return {
      level: "Low",
      interpretation:
        "Your child often doubts their abilities and may want to give up quickly because they worry they aren\u2019t \u201cnaturally good\u201d at a task.",
    };
  }
}

/**
 * Get emotion regulation data based on raw score.
 * Score range: 7-14. Low: 7-9, Moderate: 10-12, High: 13-14.
 */
function getEmotionRegulationFullData(score: number): { level: string; interpretation: string } {
  if (score >= 13) {
    return {
      level: "High",
      interpretation:
        "Your child is very aware of their emotions, knows how to cheer themselves up when sad, and shows a kind understanding of why friends might be upset.",
    };
  } else if (score >= 10) {
    return {
      level: "Moderate",
      interpretation:
        "Your child handles daily emotions well but may struggle to stay calm during high-pressure moments, like a big school test or a lost game.",
    };
  } else {
    return {
      level: "Low",
      interpretation:
        "Your child often feels overwhelmed by \u201cbig\u201d feelings like anger or worry and may find it hard to explain exactly why they are upset.",
    };
  }
}

/**
 * Get self-regulation data based on raw score.
 * Score range: 9-18. Low: 9-11, Moderate: 12-15, High: 16-18.
 */
function getSelfRegulationFullData(score: number): { level: string; interpretation: string } {
  if (score >= 16) {
    return {
      level: "High",
      interpretation:
        "Your child shows great independence, staying focused on their work even if it\u2019s a bit boring and waiting patiently for their turn.",
    };
  } else if (score >= 12) {
    return {
      level: "Moderate",
      interpretation:
        "Your child generally follows rules well but can get distracted or impulsive when they are very excited or in a noisy environment.",
    };
  } else {
    return {
      level: "Low",
      interpretation:
        "Your child finds it difficult to manage impulses or stay quiet when asked, often needing an adult\u2019s help to stay organized and finish tasks.",
    };
  }
}

// ========== VALUE PHRASE/MEANING LOOKUPS ==========

const VALUE_PHRASES: Record<string, string> = {
  Honesty: "Telling the truth even if it's a bit scary",
  Kindness: "Helping others and being kind to everyone",
  Patience: "Waiting calmly for my turn",
  Curiosity: "Asking 'Why?' and wanting to learn more",
  Respect: "Treating everyone with dignity",
  Courage: "Being brave even when scared",
  Gratitude: "Being thankful for what I have",
  Fairness: "Making sure everyone gets equal treatment",
  Responsibility: "Taking care of my duties",
  Perseverance: "Keeping going even when things get tough",
};

const VALUE_RANK_MEANINGS: Record<number, string> = {
  1: "This is your core identity - the 'WHY' behind your biggest choices",
  2: "This is your style of action - the 'HOW' you interact with the world",
  3: "This is your safety net - the value you lean on when things get tough",
};

// MeasuredQuality ID constants (from database)
const MQ_ID_VALUES = 7;
const MQ_ID_ENVIRONMENTAL_AWARENESS = 8;

// MeasuredQualityType ID constants
const MQT_ID_SOCIAL_INSIGHT = 36;
const MQT_ID_SELF_EFFICACY = 48;
const MQT_ID_EMOTION_REGULATION = 49;
const MQT_ID_SELF_MANAGEMENT = 52;

// Self Management score ranges (from interpretation guidelines)
const MIN_SELF_EFFICACY = 11;
const MAX_SELF_EFFICACY = 22;
const MIN_EMOTION_REGULATION = 7;
const MAX_EMOTION_REGULATION = 14;
const MIN_SELF_REGULATION = 9;
const MAX_SELF_REGULATION = 18;

/**
 * Process a single bet-assessment's raw data into the DashboardData shape.
 * Computes all metrics client-side from answers and rawScores.
 */
export function processBetAssessmentData(
  assessmentData: DashboardApiAssessmentData,
  studentId: number
): DashboardData {
  const { answers, rawScores } = assessmentData;

  // --- ENVIRONMENTAL AWARENESS (from answers for friendly/unfriendly breakdown) ---
  let friendlyChoices = 0;
  let unfriendlyChoices = 0;

  answers.forEach((answer) => {
    if (answer.selectedOption?.mqtScores) {
      answer.selectedOption.mqtScores.forEach((mqtScore) => {
        if (
          mqtScore.measuredQualityType?.measuredQuality?.measuredQualityId ===
          MQ_ID_ENVIRONMENTAL_AWARENESS
        ) {
          if (mqtScore.score > 0) friendlyChoices++;
          else if (mqtScore.score < 0) unfriendlyChoices++;
        }
      });
    }
  });

  const envNetScore = friendlyChoices - unfriendlyChoices;
  const envResult = getEnvironmentalCategory(envNetScore);
  const environmentalAwareness: EnvironmentalAwarenessData = {
    netScore: envNetScore,
    category: envResult.category,
    icon: envResult.icon,
    friendlyChoices,
    unfriendlyChoices,
    interpretation: envResult.interpretation,
  };

  // --- VALUES (from answers with rankOrder) ---
  const valuesMap: Map<string, { name: string; rank: number; optionText: string }> = new Map();

  answers.forEach((answer) => {
    if (answer.rankOrder != null && answer.selectedOption?.mqtScores) {
      answer.selectedOption.mqtScores.forEach((mqtScore) => {
        if (
          mqtScore.measuredQualityType?.measuredQuality?.measuredQualityId ===
          MQ_ID_VALUES
        ) {
          const valueName = mqtScore.measuredQualityType.name;
          // Keep the entry with the best (lowest) rank for each value
          if (!valuesMap.has(valueName) || answer.rankOrder! < valuesMap.get(valueName)!.rank) {
            valuesMap.set(valueName, {
              name: valueName,
              rank: answer.rankOrder!,
              optionText: answer.selectedOption.optionText || "",
            });
          }
        }
      });
    }
  });

  const valuesData: ValueData[] = Array.from(valuesMap.values())
    .sort((a, b) => a.rank - b.rank)
    .map((v) => ({
      name: v.name,
      phrase: VALUE_PHRASES[v.name] || v.optionText,
      meaning: VALUE_RANK_MEANINGS[v.rank] || `Rank ${v.rank} value in your personal hierarchy`,
      rank: v.rank,
    }));

  // --- SOCIAL INSIGHT (from rawScores) ---
  const socialInsightRawScore = rawScores.find(
    (rs) => rs.measuredQualityType?.measuredQualityTypeId === MQT_ID_SOCIAL_INSIGHT
  );
  const socialInsightTotalScore = socialInsightRawScore?.rawScore || 0;

  const siResult = getSocialInsightFullData(socialInsightTotalScore);

  const socialInsightData: SocialInsightData = {
    score: socialInsightTotalScore,
    category: siResult.category,
    awarenessLevel: siResult.awarenessLevel,
    categoryTitle: siResult.categoryTitle,
    interpretation: siResult.interpretation,
    detailedInterpretation: siResult.detailedInterpretation,
    traits: siResult.traits,
    topDomains: [],
    growthAreas: [],
  };

  // --- SELF MANAGEMENT (from rawScores) ---
  const selfEfficacyRaw = rawScores.find(
    (rs) => rs.measuredQualityType?.measuredQualityTypeId === MQT_ID_SELF_EFFICACY
  );
  const emotionRegRaw = rawScores.find(
    (rs) => rs.measuredQualityType?.measuredQualityTypeId === MQT_ID_EMOTION_REGULATION
  );
  const selfMgmtRaw = rawScores.find(
    (rs) => rs.measuredQualityType?.measuredQualityTypeId === MQT_ID_SELF_MANAGEMENT
  );

  const selfManagementData: SelfManagementData = {
    selfEfficacy: selfEfficacyRaw
      ? (() => {
          const seData = getSelfEfficacyFullData(selfEfficacyRaw.rawScore);
          return {
            rawScore: selfEfficacyRaw.rawScore,
            minScore: MIN_SELF_EFFICACY,
            maxScore: MAX_SELF_EFFICACY,
            level: seData.level,
            interpretation: seData.interpretation,
          };
        })()
      : undefined,
    emotionalRegulation: emotionRegRaw
      ? (() => {
          const erData = getEmotionRegulationFullData(emotionRegRaw.rawScore);
          return {
            rawScore: emotionRegRaw.rawScore,
            minScore: MIN_EMOTION_REGULATION,
            maxScore: MAX_EMOTION_REGULATION,
            level: erData.level,
            interpretation: erData.interpretation,
          };
        })()
      : undefined,
    selfRegulation: selfMgmtRaw
      ? (() => {
          const srData = getSelfRegulationFullData(selfMgmtRaw.rawScore);
          return {
            rawScore: selfMgmtRaw.rawScore,
            minScore: MIN_SELF_REGULATION,
            maxScore: MAX_SELF_REGULATION,
            level: srData.level,
            interpretation: srData.interpretation,
          };
        })()
      : undefined,
  };

  // --- BUILD FINAL DASHBOARD DATA ---
  return {
    student: {
      userStudentId: studentId,
      name: "Student",
      assessmentDate: assessmentData.startDate || new Date().toLocaleDateString(),
    },
    cognitive: {
      // Cognitive data comes from games, not questionnaire answers
    },
    social: {
      socialInsight: socialInsightTotalScore > 0 ? socialInsightData : undefined,
      values: valuesData.length > 0 ? valuesData : undefined,
      environmentalAwareness:
        friendlyChoices > 0 || unfriendlyChoices > 0 ? environmentalAwareness : undefined,
    },
    selfManagement: selfManagementData,
  };
}

/**
 * Process dashboard data from cached API response for a specific assessment.
 * Returns the computed DashboardData and whether it's a bet-assessment.
 */
export async function getDashboardDataFromCache(
  studentId: number,
  cachedResponse: DashboardApiResponse,
  assessmentId: number
): Promise<{ data: DashboardData; isBetAssessment: boolean }> {
  const assessmentData = cachedResponse.assessments.find(
    (a) => a.assessmentId === assessmentId
  );

  if (!assessmentData) {
    throw new Error(`Assessment ${assessmentId} not found in cached data`);
  }

  const isBetAssessment = assessmentData.questionnaireType === true;

  let dashboardData: DashboardData;

  if (isBetAssessment) {
    dashboardData = processBetAssessmentData(assessmentData, studentId);
  } else {
    // General type - return minimal data with empty sections
    dashboardData = {
      student: {
        userStudentId: studentId,
        name: "Student",
        assessmentDate: new Date().toLocaleDateString(),
      },
      cognitive: {},
      social: {},
      selfManagement: {},
    };
  }

  // Fetch cognitive data from Firebase game results
  try {
    const gameResults = await fetchGameResults(studentId);
    if (gameResults) {
      dashboardData.cognitive = processGameResults(gameResults);
    }
  } catch (error) {
    console.warn("Failed to fetch game results for cognitive data:", error);
  }

  // Enrich student info from demographics endpoint
  try {
    const studentResponse = await axios.get(
      `${API_BASE_URL}/student-info/getDemographics/${studentId}`
    );
    const studentData = studentResponse.data;
    dashboardData.student = {
      ...dashboardData.student,
      name: studentData.name || "Student",
      grade: studentData.studentClass?.toString() || "N/A",
      schoolBoard: studentData.schoolBoard || "N/A",
      familyType: studentData.family || "N/A",
      siblingsCount: studentData.sibling || 0,
    };
  } catch (error) {
    console.warn("Failed to fetch student demographics:", error);
  }

  return { data: dashboardData, isBetAssessment };
}

/**
 * @deprecated Use getDashboardDataFromCache() instead.
 * Fetch complete dashboard data for a student (old 3-endpoint approach)
 * @param studentId - Student ID
 * @param assessmentId - Optional assessment ID to filter by specific assessment
 */
export async function getDashboardData(studentId: number, assessmentId?: number | null): Promise<DashboardData> {
  try {
    // Fetch student basic info from backend using the demographics endpoint
    let studentInfo: StudentInfo;
    try {
      const studentResponse = await axios.get(`${API_BASE_URL}/student-info/getDemographics/${studentId}`);
      const studentData = studentResponse.data;

      console.log("Student demographics fetched:", studentData);

      studentInfo = {
        userStudentId: studentId,
        name: studentData.name || "Student",
        grade: studentData.studentClass?.toString() || "N/A",
        schoolBoard: studentData.schoolBoard || "N/A",
        familyType: studentData.family || "N/A",
        siblingsCount: studentData.sibling || 0,
        assessmentDate: new Date().toLocaleDateString(),
        schoolName: "School", // TODO: Add institute lookup
        schoolLogo: undefined,
      };
    } catch (error) {
      console.warn("Failed to fetch student demographics, using fallback:", error);
      // Fallback student info if API fails
      studentInfo = {
        userStudentId: studentId,
        name: "Student",
        grade: "N/A",
        schoolBoard: "N/A",
        familyType: "N/A",
        siblingsCount: 0,
        assessmentDate: new Date().toLocaleDateString(),
        schoolName: "School",
        schoolLogo: undefined,
      };
    }

    // Build query params for assessmentId filtering
    const params = assessmentId ? { assessmentId } : {};

    // Fetch cognitive data (game results) from backend
    let cognitiveRaw: any = {};
    try {
      const cognitiveResponse = await axios.get(`${API_BASE_URL}/dashboard/game-results/${studentId}`, { params });
      cognitiveRaw = cognitiveResponse.data;
      console.log("Cognitive data fetched:", cognitiveRaw);
    } catch (error) {
      console.warn("Failed to fetch cognitive data, using demo data:", error);
      // Use demo data if API fails or no data available
      cognitiveRaw = {
        attention: {
          hits: 18,
          misses: 6,
          falsePositives: 6,
          totalTargets: 24,
          totalNonTargets: 96,
        },
        workingMemory: {
          levelReached: 5,
          pathwaysCompleted: 10,
          rawScore: 10,
        },
        cognitiveFlexibility: {
          time: 85,
          aimlessClicks: 2,
          puzzlesCompleted: 2,
          curiousClicks: 3,
        },
      };
    }

    // Process Attention data
    let attentionData: AttentionData | undefined;
    if (cognitiveRaw.attention) {
      const { hits, misses, falsePositives, totalTargets, totalNonTargets } = cognitiveRaw.attention;
      const dPrime = calculateDPrime(hits || 0, totalTargets || 24, falsePositives || 0, totalNonTargets || 96);
      const category = getAttentionCategory(dPrime);
      const { interpretation, actionTip } = getAttentionInterpretation(category);

      attentionData = {
        dPrimeScore: dPrime,
        category,
        hits: hits || 0,
        misses: misses || 0,
        falsePositives: falsePositives || 0,
        interpretation,
        actionTip,
      };
    }

    // Process Working Memory data
    let workingMemoryData: WorkingMemoryData | undefined;
    if (cognitiveRaw.workingMemory) {
      const { levelReached, pathwaysCompleted, rawScore } = cognitiveRaw.workingMemory;
      const score = rawScore || 0;
      const category = getWorkingMemoryCategory(score);
      const { interpretation, actionTip } = getWorkingMemoryInterpretation(category);

      workingMemoryData = {
        levelReached: levelReached || (score >= 10 ? 3 : score >= 6 ? 2 : 1),
        rawScore: score,
        category,
        pathwaysCompleted: pathwaysCompleted || 0,
        interpretation,
        actionTip,
      };
    }

    // Process Cognitive Flexibility data
    let cognitiveFlexibilityData: CognitiveFlexibilityData | undefined;
    if (cognitiveRaw.cognitiveFlexibility) {
      const { time, aimlessClicks, puzzlesCompleted, curiousClicks } = cognitiveRaw.cognitiveFlexibility;
      const style = getCognitiveFlexibilityStyle(time || 0, aimlessClicks || 0);
      const { interpretation, actionTip } = getCognitiveFlexibilityInterpretation(style);

      cognitiveFlexibilityData = {
        style,
        time: time || 0,
        aimlessClicks: aimlessClicks || 0,
        puzzlesCompleted: puzzlesCompleted || 0,
        curiousClicks: curiousClicks || 0,
        interpretation,
        actionTip,
      };
    }

    // Fetch social data (assessment scores) from backend
    let socialRaw: any = {};
    try {
      const socialResponse = await axios.get(`${API_BASE_URL}/dashboard/assessment-scores/${studentId}`, { params });
      socialRaw = socialResponse.data;
      console.log("Social data fetched:", socialRaw);
    } catch (error) {
      console.warn("Failed to fetch social data, using demo data:", error);
      // Use demo data if API fails or no data available
      socialRaw = {
        socialInsight: {
          totalScore: 14,
          topDomains: [
            { name: "Pro-social Deception", score: 2 },
            { name: "Sarcasm Detection", score: 2 },
            { name: "Intention Attribution", score: 2 },
          ],
          growthAreas: [
            { name: "Social Faux Pas", score: 0 },
            { name: "Double Bluffing", score: 1 },
          ],
        },
        values: [
          {
            name: "Honesty",
            phrase: "Telling the truth even if it's a bit scary",
            meaning: "This is your core identity - the 'WHY' behind your biggest choices",
            rank: 1,
          },
          {
            name: "Kindness",
            phrase: "Helping others and being kind to everyone",
            meaning: "This is your style of action - the 'HOW' you interact with the world",
            rank: 2,
          },
          {
            name: "Curiosity",
            phrase: "Asking 'Why?' and wanting to learn more",
            meaning: "This is your safety net - the value you lean on when things get tough",
            rank: 3,
          },
        ],
        environmentalAwareness: {
          friendlyChoices: 3,
          unfriendlyChoices: 1,
        },
      };
    }

    // Process Social Insight data
    let socialInsightData: SocialInsightData | undefined;
    if (socialRaw.socialInsight) {
      const score = socialRaw.socialInsight.totalScore || 0;
      const siFullData = getSocialInsightFullData(score);

      socialInsightData = {
        score,
        category: siFullData.category,
        awarenessLevel: siFullData.awarenessLevel,
        categoryTitle: siFullData.categoryTitle,
        interpretation: siFullData.interpretation,
        detailedInterpretation: siFullData.detailedInterpretation,
        traits: siFullData.traits,
        topDomains: socialRaw.socialInsight.topDomains || [],
        growthAreas: socialRaw.socialInsight.growthAreas || [],
      };
    }

    // Process Values data
    const valuesData: ValueData[] = socialRaw.values || [];

    // Process Environmental Awareness data
    let environmentalAwarenessData: EnvironmentalAwarenessData | undefined;
    if (socialRaw.environmentalAwareness) {
      const { friendlyChoices, unfriendlyChoices } = socialRaw.environmentalAwareness;
      const netScore = friendlyChoices - unfriendlyChoices;
      const { category, icon, interpretation } = getEnvironmentalCategory(netScore);

      environmentalAwarenessData = {
        netScore,
        category,
        icon,
        friendlyChoices: friendlyChoices || 0,
        unfriendlyChoices: unfriendlyChoices || 0,
        interpretation,
      };
    }

    // Fetch self-management data from backend
    let selfManagementRaw: any = {};
    try {
      const selfManagementResponse = await axios.get(`${API_BASE_URL}/dashboard/self-management/${studentId}`, { params });
      selfManagementRaw = selfManagementResponse.data;
      console.log("Self-management data fetched:", selfManagementRaw);
    } catch (error) {
      console.warn("Failed to fetch self-management data, using demo data:", error);
      // Use demo data if API fails or no data available
      selfManagementRaw = {
        selfEfficacy: {
          rawScore: 19,
          minScore: 11,
          maxScore: 22,
          level: "High",
          interpretation:
            "Your child has a \u201ccan-do\u201d attitude, seeing mistakes as a natural part of learning and staying determined even when a task gets tough.",
        },
        emotionalRegulation: {
          rawScore: 11,
          minScore: 7,
          maxScore: 14,
          level: "Moderate",
          interpretation:
            "Your child handles daily emotions well but may struggle to stay calm during high-pressure moments, like a big school test or a lost game.",
        },
        selfRegulation: {
          rawScore: 16,
          minScore: 9,
          maxScore: 18,
          level: "High",
          interpretation:
            "Your child shows great independence, staying focused on their work even if it\u2019s a bit boring and waiting patiently for their turn.",
        },
      };
    }

    const selfManagementData: SelfManagementData = {
      selfEfficacy: selfManagementRaw.selfEfficacy || selfManagementRaw.selfEfficacy,
      emotionalRegulation: selfManagementRaw.emotionalRegulation || selfManagementRaw.emotionalRegulation,
      selfRegulation: selfManagementRaw.selfRegulation || selfManagementRaw.selfRegulation,
    };

    return {
      student: studentInfo,
      cognitive: {
        attention: attentionData,
        workingMemory: workingMemoryData,
        cognitiveFlexibility: cognitiveFlexibilityData,
      },
      social: {
        socialInsight: socialInsightData,
        values: valuesData,
        environmentalAwareness: environmentalAwarenessData,
      },
      selfManagement: selfManagementData,
    };
  } catch (error) {
    console.error("Error fetching dashboard data:", error);
    throw error;
  }
}

// ========== EXCEL EXPORT ==========

/**
 * Export a bet-assessment's scores to Excel.
 * Headers are fully dynamic — derived from Measured Qualities and their Quality Types
 * found in the assessment's rawScores. Cells contain the raw score values.
 *
 * Column layout: userStudentId | Name | Class | Cognitive columns | [MQ - MQT columns from rawScores...]
 * MQTs are grouped by their parent MQ (sorted by MQ ID, then MQT ID within each group).
 * If an MQ has a single MQT with the same name, the column header is just the MQ name.
 */
export function exportBetAssessmentToExcel(
  assessmentData: DashboardApiAssessmentData,
  studentInfo: StudentInfo,
  cognitiveData?: CognitiveData
): void {
  const XLSX = require("xlsx");

  const { rawScores } = assessmentData;

  // Group rawScores by Measured Quality
  const mqGroups: Map<
    number,
    { mqName: string; types: { mqtName: string; score: number; mqtId: number }[] }
  > = new Map();

  rawScores.forEach((rs) => {
    const mqId = rs.measuredQuality?.measuredQualityId ?? 0;
    const mqName = rs.measuredQuality?.displayName || rs.measuredQuality?.name || "Unknown";
    const mqtName =
      rs.measuredQualityType?.displayName || rs.measuredQualityType?.name || "Unknown";
    const mqtId = rs.measuredQualityType?.measuredQualityTypeId ?? 0;

    if (!mqGroups.has(mqId)) {
      mqGroups.set(mqId, { mqName, types: [] });
    }
    mqGroups.get(mqId)!.types.push({ mqtName, score: rs.rawScore, mqtId });
  });

  // Sort: MQ groups by MQ ID, MQTs within each group by MQT ID
  const sortedGroups = Array.from(mqGroups.entries())
    .sort(([a], [b]) => a - b)
    .map(([, group]) => ({
      ...group,
      types: group.types.sort((a, b) => a.mqtId - b.mqtId),
    }));

  // Build the row object dynamically
  const row: Record<string, string | number> = {
    userStudentId: studentInfo.userStudentId,
    Name: studentInfo.name || "Student",
    Class: studentInfo.grade || "N/A",
  };

  // --- Cognitive data (game results) ---
  if (cognitiveData?.attention) {
    const a = cognitiveData.attention;
    row["Attention - d' Score"] = Number(a.dPrimeScore.toFixed(2));
    row["Attention - Hits"] = a.hits;
    row["Attention - Misses"] = a.misses;
    row["Attention - False Positives"] = a.falsePositives;
    row["Attention - Category"] = a.category;
  }
  if (cognitiveData?.workingMemory) {
    const wm = cognitiveData.workingMemory;
    row["Working Memory - Raw Score"] = wm.rawScore;
    row["Working Memory - Level Reached"] = wm.levelReached;
    row["Working Memory - Category"] = wm.category;
  }
  if (cognitiveData?.cognitiveFlexibility) {
    const cf = cognitiveData.cognitiveFlexibility;
    row["Cognitive Flexibility - Time (sec)"] = cf.time;
    row["Cognitive Flexibility - Aimless Clicks"] = cf.aimlessClicks;
    row["Cognitive Flexibility - Puzzles Completed"] = cf.puzzlesCompleted;
    row["Cognitive Flexibility - Style"] = cf.style;
  }

  // --- Assessment rawScores (MQ/MQT) ---
  sortedGroups.forEach((group) => {
    // Individual MQT columns
    group.types.forEach((type) => {
      const colName =
        group.types.length === 1 && type.mqtName === group.mqName
          ? group.mqName
          : `${group.mqName} - ${type.mqtName}`;
      row[colName] = type.score;
    });

    // MQ total — sum of all MQT scores in this group
    const total = group.types.reduce((sum, t) => sum + t.score, 0);
    row[`${group.mqName} Total`] = total;
  });

  const ws = XLSX.utils.json_to_sheet([row]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Sheet1");

  const fileName = `BET_Assessment_${studentInfo.name || "Student"}_${assessmentData.assessmentId}.xlsx`;
  XLSX.writeFile(wb, fileName);
}

/**
 * Download PDF report
 */
export async function downloadPDFReport(studentId: number): Promise<Blob> {
  try {
    const response = await axios.get(`${API_BASE_URL}/reports/student/${studentId}/pdf`, {
      responseType: 'blob',
    });
    return response.data;
  } catch (error) {
    console.error("Error downloading PDF:", error);
    throw error;
  }
}
