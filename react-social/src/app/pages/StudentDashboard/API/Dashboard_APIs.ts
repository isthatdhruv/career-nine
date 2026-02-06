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
  interpretation: string;
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
  level: string;
  interpretation: string;
}

export interface EmotionalRegulationData {
  level: string;
  interpretation: string;
}

export interface SelfRegulationData {
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
 * Get working memory category
 */
function getWorkingMemoryCategory(levelReached: number): string {
  if (levelReached >= 5) return "Multifaceted";
  if (levelReached >= 3) return "Sequential";
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
 * Get social insight category
 */
function getSocialInsightCategory(score: number): string {
  if (score >= 13) return "High Awareness - Mind Reader";
  if (score >= 7) return "Moderate Awareness - Social Detective";
  return "Low Awareness - Literal Thinker";
}

/**
 * Get social insight interpretation
 */
function getSocialInsightInterpretation(category: string): string {
  const interpretations: Record<string, string> = {
    "High Awareness - Mind Reader": "You possess advanced socio-cognitive maturity. You excel at 'mentalizing'—tracking multiple layers of thought simultaneously. You can distinguish between a speaker's literal words and their strategic goal, allowing you to navigate complex social hierarchies with high emotional intelligence.",
    "Moderate Awareness - Social Detective": "You show healthy, age-appropriate development of social intuition. You can accurately navigate most everyday social challenges. You understand that mistakes are different from being mean, and can tell when a friend is being sarcastic to vent frustration.",
    "Low Awareness - Literal Thinker": "You process social information in a concrete and literal manner. In the Indian social context—where politeness and 'saving face' often lead to indirect communication—you may find it difficult to identify 'white lies' or subtle sarcasm. This is a common developmental stage where you're still building the 'mental muscles' needed to decouple a person's words from their actual intent."
  };

  return interpretations[category] || interpretations["Moderate Awareness - Social Detective"];
}

/**
 * Get environmental awareness category
 */
function getEnvironmentalCategory(netScore: number): { category: string; icon: string; interpretation: string } {
  if (netScore >= 4) {
    return {
      category: "Mighty Tree",
      icon: "🌳",
      interpretation: "You are a true Earth Guardian! You consistently look past the 'shiny' stuff to choose what is best for the planet."
    };
  } else if (netScore >= 0) {
    return {
      category: "Growing Sapling",
      icon: "🌿",
      interpretation: "You are a great observer! You are balancing convenience with caring for the planet in your daily life."
    };
  } else {
    return {
      category: "Seedling Starter",
      icon: "🌱",
      interpretation: "You currently prefer things that are quick and easy—try swapping one 'convenient' choice for a 'green' one this week!"
    };
  }
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
 * Fetch complete dashboard data for a student
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
      const category = getWorkingMemoryCategory(levelReached || 1);
      const { interpretation, actionTip } = getWorkingMemoryInterpretation(category);

      workingMemoryData = {
        levelReached: levelReached || 1,
        rawScore: rawScore || 0,
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
      const category = getSocialInsightCategory(score);
      const interpretation = getSocialInsightInterpretation(category);

      socialInsightData = {
        score,
        category,
        interpretation,
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
          level: "High",
          interpretation:
            "Your child has a 'can-do' attitude, seeing mistakes as a natural part of learning and staying determined even when a task gets tough.",
        },
        emotionalRegulation: {
          level: "Moderate",
          interpretation:
            "Your child handles daily emotions well but may struggle to stay calm during high-pressure moments, like a big school test or a lost game.",
        },
        selfRegulation: {
          level: "High",
          interpretation:
            "Your child shows excellent impulse control and can follow rules well, staying focused even in exciting environments.",
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
