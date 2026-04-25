/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { GoogleGenAI } from '@google/genai';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, User, signOut } from 'firebase/auth';
import { getFirestore, doc, setDoc, serverTimestamp, getDoc, increment } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import { 
  Beaker, 
  Calculator, 
  Globe, 
  BookOpen, 
  Folder, 
  FileCode,
  ClipboardList, 
  HelpCircle, 
  Zap,
  ChevronDown,
  LayoutDashboard,
  LayoutList,
  AlertCircle,
  Target,
  Brain,
  CheckCircle,
  XCircle,
  ArrowRight,
  RefreshCw,
  Library,
  LogOut,
  LogIn,
  CheckCircle2
} from 'lucide-react';

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
const googleProvider = new GoogleAuthProvider();

// === Dashboard Component ===
function ProgressDashboard({ user }: { user: User }) {
  const [progressData, setProgressData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProgress = async () => {
      try {
        const { collection, getDocs } = await import('firebase/firestore');
        const querySnapshot = await getDocs(collection(db, 'users', user.uid, 'progress'));
        const data = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setProgressData(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchProgress();
  }, [user]);

  const getChapterName = (chapterId: string) => {
    for (const subject of Object.values(subjectsData)) {
      const chapter = subject.chapters.find(c => c.id === chapterId);
      if (chapter) return `${subject.name} - ${chapter.name}`;
    }
    return chapterId;
  };

  if (loading) {
    return <div className="p-8 text-center text-text-muted">Loading progress...</div>;
  }

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 fade-in">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-12 h-12 bg-primary text-white rounded-full flex items-center justify-center font-bold text-xl">
          {user.displayName?.charAt(0) || 'U'}
        </div>
        <div>
          <h2 className="text-2xl font-bold text-text-dark">{user.displayName}'s Profile</h2>
          <p className="text-sm text-text-muted">Mastery Dashboard</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-border overflow-hidden">
        <div className="px-6 py-4 border-b border-border bg-gray-50 flex justify-between items-center">
          <h3 className="font-semibold text-text-dark">Chapter Progress</h3>
        </div>
        <div className="p-6">
          {progressData.length === 0 ? (
            <div className="text-center py-8 text-text-muted">
              No progress tracked yet. Complete a Flashcard Revision or Quiz to see your mastery score here.
            </div>
          ) : (
            <div className="space-y-6">
              {progressData.map(progress => (
                <div key={progress.id} className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 border border-border rounded-lg hover:border-primary/30 transition-colors bg-gray-50/50">
                  <div className="flex-1">
                    <h4 className="font-semibold text-text-dark text-sm md:text-base mb-1">
                      {getChapterName(progress.chapterId)}
                    </h4>
                    <div className="flex gap-4 text-xs font-medium text-text-muted">
                      <span className="text-emerald-600 border border-emerald-100 bg-emerald-50 px-2 py-0.5 rounded">Easy: {progress.easyCount || 0}</span>
                      <span className="text-amber-600 border border-amber-100 bg-amber-50 px-2 py-0.5 rounded">Good: {progress.goodCount || 0}</span>
                      <span className="text-rose-600 border border-rose-100 bg-rose-50 px-2 py-0.5 rounded">Hard: {progress.hardCount || 0}</span>
                      {(progress.quizAttempts || 0) > 0 && (
                        <span className="text-indigo-600 border border-indigo-100 bg-indigo-50 px-2 py-0.5 rounded">Quiz Best: {progress.quizBestScore || 0}%</span>
                      )}
                    </div>
                  </div>
                  <div className="shrink-0 flex items-center gap-3">
                    <div className="text-right">
                      <div className="text-sm font-bold text-text-dark mb-1">Mastery Score</div>
                      <div className="w-32 h-2.5 bg-gray-200 rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full ${
                            progress.masteryScore >= 80 ? 'bg-emerald-500' :
                            progress.masteryScore >= 50 ? 'bg-amber-400' : 'bg-rose-500'
                          }`}
                          style={{ width: `${Math.min(100, Math.max(0, progress.masteryScore || 0))}%` }}
                        ></div>
                      </div>
                    </div>
                    <div className={`text-xl font-black w-14 text-right ${
                      progress.masteryScore >= 80 ? 'text-emerald-600' :
                      progress.masteryScore >= 50 ? 'text-amber-600' : 'text-rose-600'
                    }`}>
                      {progress.masteryScore || 0}%
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// === Interactive MCQ Quiz Component ===
function InteractiveQuiz({ htmlContent, onExit, user, chapterId }: { htmlContent: string, onExit: () => void, user: User | null, chapterId: string }) {
  const [questions, setQuestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [hasAnswered, setHasAnswered] = useState(false);
  const [score, setScore] = useState(0);
  const [isFinished, setIsFinished] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pastMistakes, setPastMistakes] = useState<string[]>([]);
  const [sessionMistakes, setSessionMistakes] = useState<any[]>([]);

  useEffect(() => {
    if (isFinished && user && questions.length > 0) {
       const finalScorePercent = Math.round((score / questions.length) * 100);
       const docRef = doc(db, 'users', user.uid, 'progress', chapterId);
       
       import('firebase/firestore').then(({ getDoc, setDoc, serverTimestamp }) => {
         getDoc(docRef).then(snap => {
           const sessionMistakeTexts = sessionMistakes.map(m => m.question);

           if (snap.exists()) {
             const existing = snap.data();
             const existingMistakes = existing.quizMistakes || [];
             const updatedMistakes = Array.from(new Set([...sessionMistakeTexts, ...existingMistakes])).slice(0, 15);

             setDoc(docRef, {
               ...existing,
               quizMistakes: updatedMistakes,
               quizBestScore: Math.max(existing.quizBestScore || 0, finalScorePercent),
               quizAttempts: (existing.quizAttempts || 0) + 1,
               updatedAt: serverTimestamp()
             }, { merge: true });
           } else {
             setDoc(docRef, {
               chapterId: chapterId,
               quizBestScore: finalScorePercent,
               quizAttempts: 1,
               quizMistakes: sessionMistakeTexts.slice(0, 15),
               easyCount: 0, goodCount: 0, hardCount: 0, masteryScore: 0,
               updatedAt: serverTimestamp()
             });
           }
         }).catch(err => console.error("Error saving quiz progress:", err));
       });
    }
  }, [isFinished, user, chapterId, score, questions.length, sessionMistakes]);

  useEffect(() => {
    let mounted = true;
    const generateQuiz = async () => {
      let previousMistakes: string[] = [];
      if (user) {
        try {
          const { getDoc } = await import('firebase/firestore');
          const docRef = doc(db, 'users', user.uid, 'progress', chapterId);
          const snap = await getDoc(docRef);
          if (snap.exists() && snap.data().quizMistakes) {
            previousMistakes = snap.data().quizMistakes || [];
            if (mounted) setPastMistakes(previousMistakes);
          }
        } catch (e) { console.error('Failed to fetch past mistakes', e); }
      }

      try {
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
        const textContent = htmlContent.replace(/<[^>]*>?/gm, ' ').substring(0, 4000);
        let srsContext = "";
        if (previousMistakes.length > 0) {
            srsContext = `\nSPACED REPETITION SYSTEM: The user previously struggled with these specific questions/topics:\n${previousMistakes.map(m => '- ' + m).join('\n')}\nREQUIRED: Heavily prioritize generating new, challenging questions that test these EXACT concepts to aid long-term retention.`;
        }

        const prompt = `Based on the following NCERT chapter content, generate a highly comprehensive and challenging multiple-choice quiz that strictly covers EVERY topic, EVERY subtopic, and cues from ALL activities present in the chapter. ${srsContext} Do not limit to 5-10 questions; make it exhaustive to ensure deep understanding.
Output ONLY valid JSON in this EXACT structure:
[
  {
    "question": "Question text...",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correctIndex": 0,
    "explanation": "Brief explanation of why this is correct."
  }
]
Ensure the JSON is strictly valid. No markdown wrapping.
Content: ${textContent}`;
        
        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: prompt,
        });

        let text = response.text || '';
        text = text.replace(/```json|```/gi, '').trim();
        const parsed = JSON.parse(text);
        
        if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].options) {
          if (mounted) setQuestions(parsed);
        } else {
          throw new Error('Invalid JSON structure returned');
        }
      } catch (err) {
        console.error(err);
        if (mounted) setError('Failed to generate interactive quiz from content.');
      } finally {
        if (mounted) setLoading(false);
      }
    };
    generateQuiz();
    return () => { mounted = false; };
  }, [htmlContent, chapterId, user]);

  const handleOptionSelect = (index: number) => {
    if (hasAnswered) return;
    setSelectedOption(index);
    setHasAnswered(true);
    if (index === questions[currentIndex].correctIndex) {
      setScore(prev => prev + 1);
    } else {
      setSessionMistakes(prev => {
         if (!prev.some(m => m.question === questions[currentIndex].question)) {
             return [...prev, questions[currentIndex]];
         }
         return prev;
      });
      // Intra-session SRS: Push this question to be reviewed again at the end of the quiz
      setQuestions(prev => {
         const newQ = [...prev];
         newQ.push(prev[currentIndex]);
         return newQ;
      });
    }
  };

  const handleNext = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setSelectedOption(null);
      setHasAnswered(false);
    } else {
      setIsFinished(true);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[400px]">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-text-muted font-medium animate-pulse">Generating Interactive Quiz...</p>
      </div>
    );
  }

  if (error || questions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[400px] text-center">
        <AlertCircle className="w-12 h-12 text-red-500 mb-4 opacity-50" />
        <h3 className="text-lg font-bold text-text-dark mb-2">Quiz Generation Failed</h3>
        <p className="text-text-muted max-w-md mb-6">{error || 'Could not parse quiz.'}</p>
        <button onClick={onExit} className="px-4 py-2 bg-primary text-white rounded-lg font-medium shadow-sm hover:bg-primary/90">
          Return to Preview
        </button>
      </div>
    );
  }

  if (isFinished) {
    const percentage = Math.round((score / questions.length) * 100);
    return (
      <div className="flex flex-col items-center justify-center p-8 bg-white border border-border rounded-xl shadow-sm text-center max-w-lg mx-auto my-12 animate-in fade-in zoom-in duration-300">
        <div className={`w-20 h-20 rounded-full flex items-center justify-center mb-6 border-4 ${percentage >= 80 ? 'border-emerald-100 bg-emerald-50 text-emerald-600' : percentage >= 50 ? 'border-amber-100 bg-amber-50 text-amber-600' : 'border-rose-100 bg-rose-50 text-rose-600'}`}>
          <span className="text-2xl font-black">{percentage}%</span>
        </div>
        <h2 className="text-2xl font-bold text-text-dark mb-2">Quiz Complete!</h2>
        <p className="text-text-muted mb-6">You scored {score} out of {questions.length} accurately.</p>

        {!user && (
          <div className="bg-amber-50 text-amber-800 text-sm p-3 rounded-lg border border-amber-200 mb-6 w-full text-left flex gap-2 items-start">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <p>You are not signed in. <strong>Sign in</strong> to track your quiz performance alongside your mastery scores!</p>
          </div>
        )}

        <div className="flex gap-3">
          <button onClick={() => { setCurrentIndex(0); setHasAnswered(false); setSelectedOption(null); setScore(0); setIsFinished(false); }} className="px-5 py-2.5 bg-gray-100 text-text-dark rounded-lg font-medium hover:bg-gray-200 transition-colors flex items-center gap-2">
            <RefreshCw className="w-4 h-4" /> Retake Quiz
          </button>
          <button onClick={onExit} className="px-5 py-2.5 bg-primary text-white rounded-lg font-medium shadow-sm hover:bg-primary/90 transition-colors">
            Exit to Lesson
          </button>
        </div>
      </div>
    );
  }

  const currentQ = questions[currentIndex];

  return (
    <div className="max-w-3xl mx-auto py-8 px-4 flex flex-col h-full animate-in fade-in duration-300">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2"><CheckCircle2 className="w-5 h-5 text-primary" /> Topic Quiz</h2>
          <p className="text-sm text-text-muted">Question {currentIndex + 1} of {questions.length}</p>
        </div>
        <button onClick={onExit} className="text-text-muted hover:text-text-dark text-sm font-medium px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">Exit</button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-border p-6 flex-1 flex flex-col mb-6">
        <h3 className="text-xl font-bold text-text-dark mb-6" dangerouslySetInnerHTML={{ __html: currentQ.question }}></h3>
        
        <div className="flex flex-col gap-3 flex-1">
          {currentQ.options.map((option: string, index: number) => {
            let styling = "bg-white border-border hover:border-primary/50 hover:bg-gray-50 text-text-dark";
            if (hasAnswered) {
              if (index === currentQ.correctIndex) {
                 styling = "bg-emerald-50 border-emerald-500 text-emerald-900 shadow-sm"; // Correct answer styling
              } else if (index === selectedOption) {
                 styling = "bg-rose-50 border-rose-500 text-rose-900"; // Incorrect selected answer styling
              } else {
                 styling = "bg-gray-50 border-border opacity-60 text-text-muted"; // Unselected neutral styling
              }
            } else if (selectedOption === index) {
              styling = "bg-primary-light border-primary break-words text-primary shadow-sm";
            }
            
            return (
              <button 
                key={index}
                onClick={() => handleOptionSelect(index)}
                disabled={hasAnswered}
                className={`w-full text-left p-4 rounded-xl border-2 transition-all duration-200 font-medium ${styling} flex items-start gap-3`}
              >
                <div className={`w-6 h-6 rounded-full shrink-0 flex items-center justify-center text-sm border font-bold ${
                  hasAnswered && index === currentQ.correctIndex ? 'bg-emerald-500 border-emerald-500 text-white' :
                  hasAnswered && index === selectedOption ? 'bg-rose-500 border-rose-500 text-white' :
                  'border-current opacity-70'
                }`}>
                  {String.fromCharCode(65 + index)}
                </div>
                <span dangerouslySetInnerHTML={{ __html: option }}></span>
              </button>
            );
          })}
        </div>

        {hasAnswered && (
          <div className={`mt-6 p-5 rounded-xl border animate-in slide-in-from-bottom-2 duration-300 ${selectedOption === currentQ.correctIndex ? 'bg-emerald-50 border-emerald-200' : 'bg-rose-50 border-rose-200'}`}>
            <h4 className={`font-bold mb-1 ${selectedOption === currentQ.correctIndex ? 'text-emerald-800' : 'text-rose-800'}`}>
              {selectedOption === currentQ.correctIndex ? 'Correct!' : 'Incorrect'}
            </h4>
            <p className={`text-sm ${selectedOption === currentQ.correctIndex ? 'text-emerald-700' : 'text-rose-700'}`} dangerouslySetInnerHTML={{ __html: currentQ.explanation }}></p>
          </div>
        )}
      </div>

      <div className="flex justify-end">
        <button 
          onClick={handleNext}
          disabled={!hasAnswered}
          className={`px-6 py-3 rounded-xl font-bold flex items-center gap-2 transition-all shadow-sm ${hasAnswered ? 'bg-primary text-white hover:bg-primary/90 hover:shadow transform hover:-translate-y-0.5' : 'bg-gray-100 text-text-muted cursor-not-allowed opacity-50'}`}
        >
          {currentIndex < questions.length - 1 ? 'Next Question' : 'View Results'} <ArrowRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}

// === Revision Flashcards Component ===
function FlashcardRevision({ htmlContent, onExit, user, chapterId }: { htmlContent: string, onExit: () => void, user: User | null, chapterId: string }) {
  const [cards, setCards] = useState<{front: string, back: string}[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [sessionStats, setSessionStats] = useState({ easy: 0, good: 0, hard: 0 });
  const [isFinished, setIsFinished] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isFinished && user) {
       let total = sessionStats.easy + sessionStats.good + sessionStats.hard;
       let sessionMastery = total === 0 ? 0 : Math.floor(((sessionStats.easy * 1) + (sessionStats.good * 0.5) - (sessionStats.hard * 0.5)) / total * 100);
       sessionMastery = Math.max(0, sessionMastery);

       const docRef = doc(db, 'users', user.uid, 'progress', chapterId);
       getDoc(docRef).then(snap => {
         if (snap.exists()) {
           const existing = snap.data();
           setDoc(docRef, {
             chapterId: chapterId,
             easyCount: (existing.easyCount || 0) + sessionStats.easy,
             goodCount: (existing.goodCount || 0) + sessionStats.good,
             hardCount: (existing.hardCount || 0) + sessionStats.hard,
             masteryScore: existing.masteryScore !== undefined ? Math.floor((existing.masteryScore + sessionMastery) / 2) : sessionMastery,
             updatedAt: serverTimestamp()
           }, { merge: true });
         } else {
           setDoc(docRef, {
             chapterId: chapterId,
             easyCount: sessionStats.easy,
             goodCount: sessionStats.good,
             hardCount: sessionStats.hard,
             masteryScore: sessionMastery,
             updatedAt: serverTimestamp()
           });
         }
       }).catch(err => console.error("Error saving progress:", err));
    }
  }, [isFinished, user, chapterId, sessionStats]);

  useEffect(() => {
    const generateFlashcards = async () => {
      try {
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
        const textContent = htmlContent.replace(/<[^>]*>?/gm, ' ').substring(0, 4000);
        const prompt = `Based on the following NCERT chapter content, generate an exhaustive set of flashcards covering ALL topics, sub-topics, key terms, and formulas.
Generate flashcards for EVERY concept; do not limit the count. It is crucial for exam revision that all key aspects are covered.
Ensure any mathematical or scientific symbols are preserved perfectly and formulas/diagram descriptions are extremely accurate (using standard text or valid HTML entities like &#x223F;, &pi;, H<sub>2</sub>O, etc.).
Output ONLY valid JSON in this EXACT structure:
[
  {
    "front": "Question, cue, or concept (use simple HTML if needed)",
    "back": "Detailed explanation or formula (you may use basic HTML tags like <strong> or <em>)"
  }
]
No markdown blocks or wrapping text.

Content: ${textContent}`;
        
        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: prompt,
        });

        let text = response.text || '';
        text = text.replace(/```json|```/gi, '').trim();
        const parsed = JSON.parse(text);
        
        if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].front && parsed[0].back) {
          // Decode HTML entities safely on the client side via DOMParser later, or just render with dangerouslySetInnerHTML
          setCards(parsed);
        } else {
          throw new Error('Invalid JSON structure returned');
        }
      } catch (err) {
        console.error(err);
        setError('Failed to generate comprehensive flashcards from content.');
      } finally {
        setLoading(false);
      }
    };
    generateFlashcards();
  }, [htmlContent]);

  const handleRating = (rating: 'easy' | 'good' | 'hard') => {
    setSessionStats(prev => ({ ...prev, [rating]: prev[rating] + 1 }));
    
    let newCards = [...cards];
    
    // Spaced repetition queue logic:
    if (rating === 'hard') {
      // Re-introduce hard cards very soon (e.g., 3 cards later, or at the end if fewer cards left)
      const insertAt = Math.min(currentIndex + 3, newCards.length);
      newCards.splice(insertAt, 0, cards[currentIndex]);
      setCards(newCards);
    } else if (rating === 'good') {
      // Re-introduce good cards later (e.g., 7 cards later) to ensure retention
      const insertAt = Math.min(currentIndex + 7, newCards.length);
      // Only re-introduce if we aren't near the very end anyway
      if (insertAt < newCards.length + 3) {
        newCards.splice(insertAt, 0, cards[currentIndex]);
        setCards(newCards);
      }
    }
    // "Easy" cards are not re-introduced in the current active session.
    
    if (currentIndex < newCards.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setShowAnswer(false);
    } else {
      setIsFinished(true);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[400px]">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-text-muted font-medium animate-pulse">Generating Comprehensive Flashcards...</p>
      </div>
    );
  }

  if (error || cards.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[400px] text-center">
        <AlertCircle className="w-12 h-12 text-red-500 mb-4 opacity-50" />
        <h3 className="text-lg font-bold text-text-dark mb-2">Flashcard Generation Failed</h3>
        <p className="text-text-muted max-w-md mb-6">{error || 'Could not parse flashcards.'}</p>
        <button onClick={onExit} className="px-4 py-2 bg-primary text-white rounded-lg font-medium shadow-sm hover:bg-primary/90">
          Return to Preview
        </button>
      </div>
    );
  }

  if (isFinished) {
    return (
      <div className="flex flex-col items-center justify-center p-8 bg-white border border-border rounded-xl shadow-sm text-center max-w-lg mx-auto my-12 animate-in fade-in zoom-in duration-300">
        <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-4">
          <BookOpen className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-bold text-text-dark mb-2">Revision Session Complete!</h2>
        <p className="text-text-muted mb-6">You've reviewed all {cards.length} comprehensive flashcards.</p>
        
        {!user && (
          <div className="bg-amber-50 text-amber-800 text-sm p-3 rounded-lg border border-amber-200 mb-6 w-full text-left flex gap-2 items-start">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <p>You are not signed in. <strong>Sign in</strong> to track your chapter mastery progress and help improve your performance over time!</p>
          </div>
        )}

        <div className="flex gap-4 w-full mb-8">
          <div className="flex-1 bg-green-50 p-3 rounded-lg border border-green-100">
            <div className="text-2xl font-bold text-green-600">{sessionStats.easy}</div>
            <div className="text-xs text-green-800 font-medium uppercase tracking-wider">Easy</div>
          </div>
          <div className="flex-1 bg-blue-50 p-3 rounded-lg border border-blue-100">
            <div className="text-2xl font-bold text-blue-600">{sessionStats.good}</div>
            <div className="text-xs text-blue-800 font-medium uppercase tracking-wider">Good</div>
          </div>
          <div className="flex-1 bg-orange-50 p-3 rounded-lg border border-orange-100">
            <div className="text-2xl font-bold text-orange-600">{sessionStats.hard}</div>
            <div className="text-xs text-orange-800 font-medium uppercase tracking-wider">Hard</div>
          </div>
        </div>

        <div className="flex gap-3">
          <button 
            onClick={() => { setCurrentIndex(0); setShowAnswer(false); setIsFinished(false); setSessionStats({easy:0,good:0,hard:0}); setCards([...cards].sort(() => Math.random() - 0.5)); }}
            className="px-5 py-2.5 bg-gray-100 text-text-dark rounded-lg font-medium hover:bg-gray-200 transition-colors flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" /> Restart Revision
          </button>
          <button 
            onClick={onExit}
            className="px-5 py-2.5 bg-primary text-white rounded-lg font-medium shadow-sm hover:bg-primary/90 transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    );
  }

  const currentCard = cards[currentIndex];

  return (
    <div className="max-w-2xl mx-auto py-8 flex flex-col h-full animate-in fade-in duration-300">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2"><Brain className="w-5 h-5 text-primary" /> Spaced Revision</h2>
          <p className="text-sm text-text-muted">Card {currentIndex + 1} of {cards.length}</p>
        </div>
        <button onClick={onExit} className="text-text-muted hover:text-text-dark text-sm font-medium px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">Exit</button>
      </div>

      <div className="flex-1 flex flex-col relative perspective-1000">
        <div className={`w-full bg-white border border-border shadow-md rounded-2xl p-8 min-h-[300px] flex flex-col transition-all duration-300 transform-gpu ${showAnswer ? 'border-primary/30 ring-1 ring-primary/20' : ''}`}>
          
          <div className="flex-1 flex flex-col">
            <div className="text-[11px] font-bold text-text-muted uppercase tracking-widest mb-4">Front / Cue</div>
            <div 
              className="text-2xl font-medium text-text-dark prose prose-slate mb-8"
              dangerouslySetInnerHTML={{ __html: currentCard.front }} 
            />
            
            {showAnswer ? (
              <div className="animate-in fade-in slide-in-from-top-4 duration-300 border-t border-border pt-6 mt-auto">
                <div className="text-[11px] font-bold text-primary uppercase tracking-widest mb-4">Back / Notes</div>
                <div 
                  className="prose prose-sm md:prose-base prose-slate max-w-none text-gray-700"
                  dangerouslySetInnerHTML={{ __html: currentCard.back }} 
                />
              </div>
            ) : null}
          </div>

        </div>

        <div className="mt-8 flex justify-center gap-3">
          {!showAnswer ? (
            <button 
              onClick={() => setShowAnswer(true)}
              className="w-full max-w-sm py-3.5 bg-primary text-white font-semibold rounded-xl shadow-sm hover:bg-primary/90 hover:-translate-y-0.5 transition-all shadow-primary/20"
            >
              Show Answer
            </button>
          ) : (
            <div className="flex gap-3 w-full max-w-md animate-in slide-in-from-bottom-2 fade-in duration-300">
              <button 
                onClick={() => handleRating('hard')}
                className="flex-1 py-3 bg-orange-50 text-orange-700 border border-orange-200 font-semibold rounded-xl hover:bg-orange-100 transition-colors flex items-center justify-center gap-2"
              >
                <XCircle className="w-4 h-4" /> Hard
              </button>
              <button 
                onClick={() => handleRating('good')}
                className="flex-1 py-3 bg-blue-50 text-blue-700 border border-blue-200 font-semibold rounded-xl hover:bg-blue-100 transition-colors flex items-center justify-center gap-2"
              >
                <CheckCircle className="w-4 h-4" /> Good
              </button>
              <button 
                onClick={() => handleRating('easy')}
                className="flex-1 py-3 bg-green-50 text-green-700 border border-green-200 font-semibold rounded-xl hover:bg-green-100 transition-colors flex items-center justify-center gap-2"
              >
                <ArrowRight className="w-4 h-4" /> Easy
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const subjectsData = {
  science: {
    id: 'science',
    name: 'Science',
    icon: Beaker,
    chapters: [
      { id: 'sci-1', name: 'Chemistry: Chemical Reactions and Equations' },
      { id: 'sci-2', name: 'Chemistry: Acids, Bases and Salts' },
      { id: 'sci-3', name: 'Chemistry: Metals and Non-metals' },
      { id: 'sci-4', name: 'Chemistry: Carbon and its Compounds' },
      { id: 'sci-5', name: 'Biology: Life Processes' },
      { id: 'sci-6', name: 'Biology: Control and Coordination' },
      { id: 'sci-7', name: 'Biology: How do Organisms Reproduce?' },
      { id: 'sci-8', name: 'Biology: Heredity' },
      { id: 'sci-9', name: 'Physics: Light - Reflection and Refraction' },
      { id: 'sci-10', name: 'Physics: The Human Eye and the Colourful World' },
      { id: 'sci-11', name: 'Physics: Electricity' },
      { id: 'sci-12', name: 'Physics: Magnetic Effects of Electric Current' },
      { id: 'sci-13', name: 'Biology: Our Environment' }
    ],
    prompts: [
      { icon: Target, title: 'NCERT Mastery Challenge', desc: 'Generates a comprehensive review covering every topic, subtopic, and cue from activities.' },
      { icon: LayoutDashboard, title: 'Interactive Cheat Sheet', desc: 'Generates comprehensive flashcard definitions covering all NCERT topics and sub-topics, accurate formulas and apparatus diagrams, and crucial exam-focused must-know points covering all key aspects.' },
      { icon: LayoutList, title: '1-Page Cornell Recall', desc: 'A4 print-ready sheet with 30% cue / 70% notes format and a local performance tracker.' },
      { icon: Zap, title: 'Formulas & Derivations', desc: 'Extracts Physics formulas with units, plus tooltips explaining every mapped NCERT variable.' },
    ],
    preview: {
      chapter: 'Science | Chapter 12: Electricity',
      concept: "Key Concept: Ohm's Law",
      intro: "Based on the CBSE Class 10 curriculum, Ohm's law states that the current through a conductor between two points is directly proportional to the voltage across the two points.",
      bullets: [
        { strong: 'Mathematical Expression:', text: 'V = IR, where V is potential difference, I is current, and R is resistance.' },
        { strong: 'V-I Graph:', text: 'A straight line passing through the origin indicates a constant resistance for ohmic conductors.' },
        { strong: 'Board Tip:', text: 'Always specify that temperature must remain constant while defining Ohm\'s law to secure full marks.' },
      ]
    }
  },
  math: {
    id: 'math',
    name: 'Mathematics',
    icon: Calculator,
    chapters: [
      { id: 'math-1', name: 'Real Numbers' },
      { id: 'math-2', name: 'Polynomials' },
      { id: 'math-3', name: 'Pair of Linear Equations in Two Variables' },
      { id: 'math-4', name: 'Quadratic Equations' },
      { id: 'math-5', name: 'Arithmetic Progressions' },
      { id: 'math-6', name: 'Triangles' },
      { id: 'math-7', name: 'Coordinate Geometry' },
      { id: 'math-8', name: 'Introduction to Trigonometry' },
      { id: 'math-9', name: 'Some Applications of Trigonometry' },
      { id: 'math-10', name: 'Circles' },
      { id: 'math-11', name: 'Areas Related to Circles' },
      { id: 'math-12', name: 'Surface Areas and Volumes' },
      { id: 'math-13', name: 'Statistics' },
      { id: 'math-14', name: 'Probability' }
    ],
    prompts: [
      { icon: Target, title: 'NCERT Mastery Challenge', desc: 'Generates a comprehensive review covering every topic, subtopic, and cue from activities.' },
      { icon: LayoutDashboard, title: 'Interactive Cheat Sheet', desc: 'Board-ready reference featuring key theorems, detailed steps to solve, and 5-7 must-know points.' },
      { icon: LayoutList, title: '1-Page Cornell Recall', desc: 'Daily spaced repetition card with 15-25 cue/note pairs for fast morning recall.' },
      { icon: AlertCircle, title: 'Errors & Exam Tips', desc: 'Highlights at least 3 board exam tips and common calculation errors students make.' },
    ],
    preview: {
      chapter: 'Mathematics | Chapter 2: Polynomials',
      concept: "Key Concept: Quadratic Formula",
      intro: "In algebra, a quadratic equation is any equation that can be rearranged in standard form as ax² + bx + c = 0 where x represents an unknown, and a, b, and c represent known numbers.",
      bullets: [
        { strong: 'The Formula:', text: 'x = [-b ± √(b² - 4ac)] / 2a' },
        { strong: 'Discriminant:', text: 'The value Δ = b² - 4ac determines the nature of the roots.' },
        { strong: 'Board Tip:', text: 'Always write the standard form equation before applying the formula to avoid sign errors.' },
      ]
    }
  },
  social: {
    id: 'social',
    name: 'Social Science',
    icon: Globe,
    chapters: [
      { id: 'soc-h1', name: 'History: The Rise of Nationalism in Europe' },
      { id: 'soc-h2', name: 'History: Nationalism in India' },
      { id: 'soc-h3', name: 'History: The Making of a Global World' },
      { id: 'soc-h4', name: 'History: The Age of Industrialisation' },
      { id: 'soc-h5', name: 'History: Print Culture and the Modern World' },
      { id: 'soc-g1', name: 'Geography: Resources and Development' },
      { id: 'soc-g2', name: 'Geography: Forest and Wildlife Resources' },
      { id: 'soc-g3', name: 'Geography: Water Resources' },
      { id: 'soc-g4', name: 'Geography: Agriculture' },
      { id: 'soc-g5', name: 'Geography: Minerals and Energy Resources' },
      { id: 'soc-g6', name: 'Geography: Manufacturing Industries' },
      { id: 'soc-g7', name: 'Geography: Lifelines of National Economy' },
      { id: 'soc-c1', name: 'Civics: Power Sharing' },
      { id: 'soc-c2', name: 'Civics: Federalism' },
      { id: 'soc-c3', name: 'Civics: Gender, Religion and Caste' },
      { id: 'soc-c4', name: 'Civics: Political Parties' },
      { id: 'soc-c5', name: 'Civics: Outcomes of Democracy' },
      { id: 'soc-e1', name: 'Economics: Development' },
      { id: 'soc-e2', name: 'Economics: Sectors of the Indian Economy' },
      { id: 'soc-e3', name: 'Economics: Money and Credit' },
      { id: 'soc-e4', name: 'Economics: Globalisation and the Indian Economy' },
      { id: 'soc-e5', name: 'Economics: Consumer Rights' }
    ],
    prompts: [
      { icon: Target, title: 'NCERT Mastery Challenge', desc: 'Generates a comprehensive review covering every topic, subtopic, and cue from activities.' },
      { icon: LayoutDashboard, title: 'Interactive Cheat Sheet', desc: 'Visual revision tool combining key dates, events, personalities, and flashcard definitions.' },
      { icon: LayoutList, title: '1-Page Cornell Recall', desc: 'Cover-and-test layout with chronological trigger phrases and interactive "Got it" checkboxes.' },
      { icon: Target, title: 'Must-Know Points', desc: 'Targeted checklist of 5-7 absolute must-know facts to secure full marks, with progress tracking.' },
    ],
    preview: {
      chapter: 'Social Science | Chapter 2: Nationalism in India',
      concept: "Key Concept: Non-Cooperation",
      intro: "The Non-Cooperation Movement was launched on 5th September 1920 by the Indian National Congress (INC) under the leadership of Mahatma Gandhi.",
      bullets: [
        { strong: 'Satyagraha:', text: 'The idea of Satyagraha emphasized the power of truth and the need to search for truth.' },
        { strong: 'Economic Impact:', text: 'Foreign goods were boycotted, liquor shops picketed, and foreign cloth burnt in huge bonfires.' },
        { strong: 'Board Tip:', text: 'Mention the withdrawal of the movement after the Chauri Chaura incident in 1922.' },
      ]
    }
  },
  english: {
    id: 'english',
    name: 'English Lang & Lit',
    icon: BookOpen,
    chapters: [
      { id: 'eng-f1', name: 'Prose: A Letter to God' },
      { id: 'eng-f2', name: 'Prose: Nelson Mandela' },
      { id: 'eng-f3', name: 'Prose: Two Stories about Flying' },
      { id: 'eng-f4', name: 'Prose: From the Diary of Anne Frank' },
      { id: 'eng-f5', name: 'Prose: Glimpses of India' },
      { id: 'eng-f6', name: 'Prose: Mijbil the Otter' },
      { id: 'eng-f7', name: 'Prose: Madam Rides the Bus' },
      { id: 'eng-f8', name: 'Prose: The Sermon at Benares' },
      { id: 'eng-f9', name: 'Prose: The Proposal' },
      { id: 'eng-p1', name: 'Poetry: Dust of Snow' },
      { id: 'eng-p2', name: 'Poetry: Fire and Ice' },
      { id: 'eng-p3', name: 'Poetry: A Tiger in the Zoo' },
      { id: 'eng-p4', name: 'Poetry: How to Tell Wild Animals' },
      { id: 'eng-p5', name: 'Poetry: The Ball Poem' },
      { id: 'eng-p6', name: 'Poetry: Amanda!' },
      { id: 'eng-p7', name: 'Poetry: The Trees' },
      { id: 'eng-p8', name: 'Poetry: Fog' },
      { id: 'eng-p9', name: 'Poetry: The Tale of Custard the Dragon' },
      { id: 'eng-p10', name: 'Poetry: For Anne Gregory' },
      { id: 'eng-fp1', name: 'Footprints: A Triumph of Surgery' },
      { id: 'eng-fp2', name: 'Footprints: The Thief\'s Story' },
      { id: 'eng-fp3', name: 'Footprints: The Midnight Visitor' },
      { id: 'eng-fp4', name: 'Footprints: A Question of Trust' },
      { id: 'eng-fp5', name: 'Footprints: Footprints without Feet' },
      { id: 'eng-fp6', name: 'Footprints: The Making of a Scientist' },
      { id: 'eng-fp7', name: 'Footprints: The Necklace' },
      { id: 'eng-fp8', name: 'Footprints: Bholi' },
      { id: 'eng-fp9', name: 'Footprints: The Book That Saved the Earth' }
    ],
    prompts: [
      { icon: Target, title: 'NCERT Mastery Challenge', desc: 'Generates a comprehensive review covering every topic, subtopic, and cue from activities.' },
      { icon: LayoutDashboard, title: 'Interactive Cheat Sheet', desc: 'Revision featuring interactive flashcards for character traits, themes, and robust plot elements.' },
      { icon: LayoutList, title: '1-Page Cornell Recall', desc: 'A4 revision card with quick plot trigger phrases, thematic inferences, and an elevator-pitch summary.' },
      { icon: AlertCircle, title: 'Board Tips & Errors', desc: 'Provides at least 3 essential CBSE board tips for framing Section C answers seamlessly.' },
    ],
    preview: {
      chapter: 'English | First Flight: A Letter to God',
      concept: "Key Concept: Faith and Irony",
      intro: "The story highlights Lencho's immense faith in God, contrasted with the irony of him doubting the post office employees who actually helped him.",
      bullets: [
        { strong: 'Character Trait:', text: 'Lencho is depicted as a hardworking but naive farmer who believes unequivocally in divine help.' },
        { strong: 'Situational Irony:', text: 'The people who orchestrate the charity are labelled "a bunch of crooks" by the recipient.' },
        { strong: 'Board Tip:', text: 'Reference specific textual moments demonstrating his unbroken faith when answering 5-mark questions.' },
      ]
    }
  }
};

export default function App() {
  const [activeSubjectId, setActiveSubjectId] = useState<keyof typeof subjectsData>('science');
  const [activeChapterId, setActiveChapterId] = useState('sci-11');
  const [generatedContent, setGeneratedContent] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isRevisionMode, setIsRevisionMode] = useState(false);
  const [isQuizMode, setIsQuizMode] = useState(false);
  const [showDashboard, setShowDashboard] = useState(false);
  const [isGeneratingImages, setIsGeneratingImages] = useState(false);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, u => setUser(u));
    return unsub;
  }, []);

  const login = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (e) {
      console.error(e);
    }
  };

  const logout = () => signOut(auth);

  const activeData = subjectsData[activeSubjectId];
  const activeChapter = activeData.chapters.find(c => c.id === activeChapterId) || activeData.chapters[0];

  const handleSubjectChange = (subjectId: keyof typeof subjectsData) => {
    setActiveSubjectId(subjectId);
    setActiveChapterId(subjectsData[subjectId].chapters[0].id);
    setGeneratedContent(null);
    setIsEditing(false);
    setIsRevisionMode(false);
    setIsQuizMode(false);
  };

  useEffect(() => {
    if (!isGenerating && generatedContent && generatedContent.includes('ai-image-placeholder') && !isGeneratingImages && !isQuizMode && !isRevisionMode) {
      const fetchImages = async () => {
        setIsGeneratingImages(true);
        const matches = [...generatedContent.matchAll(/<div[^>]*class=["'][^"']*ai-image-placeholder[^"']*["'][^>]*data-prompt=["']([^"']+)["'][^>]*>.*?<\/div>/gs)];
        
        if (matches.length === 0) {
           setIsGeneratingImages(false);
           return;
        }

        let currentContent = generatedContent;
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

        for (const match of matches) {
           const originalTag = match[0];
           const promptText = match[1];
           
           try {
             const generatingTag = `<figure class="my-6 p-6 bg-blue-50 border border-blue-200 border-dashed rounded-xl flex flex-col items-center justify-center animate-pulse"><div class="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-3"></div><p class="text-sm font-medium text-blue-700">Generating AI Visual Aid: <em>${promptText}</em></p></figure>`;
             currentContent = currentContent.replace(originalTag, generatingTag);
             setGeneratedContent(currentContent);

             const response = await ai.models.generateContent({
               model: 'gemini-2.5-flash-image',
               contents: { parts: [{ text: `A clean, professional, high-quality educational textbook illustration or diagram on a pure white background. Concept: ` + promptText }] },
               config: { imageConfig: { aspectRatio: "16:9" } }
             });
             
             let imageUrl = '';
             for (const part of response.candidates?.[0]?.content?.parts || []) {
               if (part.inlineData) {
                 const base64EncodeString = part.inlineData.data;
                 imageUrl = `data:${part.inlineData?.mimeType || 'image/jpeg'};base64,${base64EncodeString}`;
                 break;
               }
             }
             
             if (imageUrl) {
               const replacement = `<figure class="my-6 ai-generated-image"><img src="${imageUrl}" alt="${promptText}" class="w-full rounded-xl shadow-sm border border-border" referrerPolicy="no-referrer" /><figcaption class="text-xs text-text-muted mt-2 font-medium text-center max-w-lg mx-auto leading-relaxed">${promptText}</figcaption></figure>`;
               currentContent = currentContent.replace(generatingTag, replacement);
             } else {
               currentContent = currentContent.replace(generatingTag, `<figure class="my-6 p-4 bg-gray-50 border border-dashed border-gray-300 text-center text-sm text-gray-500 rounded-lg"><em>Image unavailable for: ${promptText}</em></figure>`);
             }
           } catch (e) {
             console.error('Image generation error:', e);
             currentContent = currentContent.replace(/<figure class="my-6 p-6 bg-blue-50[^>]*>.*?<\/figure>/s, `<figure class="my-6 p-4 bg-red-50 border border-dashed border-red-200 text-center text-sm text-red-500 rounded-lg"><em>Failed to generate image for: ${promptText}</em></figure>`);
           }
           setGeneratedContent(currentContent);
        }
        setIsGeneratingImages(false);
      };
      
      fetchImages();
    }
  }, [isGenerating, generatedContent, isGeneratingImages, isQuizMode, isRevisionMode]);

  useEffect(() => {
    if (!isGenerating && generatedContent && generatedContent.includes('ai-image-placeholder') && !isGeneratingImages && !isQuizMode && !isRevisionMode) {
      const fetchImages = async () => {
        setIsGeneratingImages(true);
        const matches = [...generatedContent.matchAll(/<div[^>]*class=["'][^"']*ai-image-placeholder[^"']*["'][^>]*data-prompt=["']([^"']+)["'][^>]*>.*?<\/div>/gs)];
        
        if (matches.length === 0) {
           setIsGeneratingImages(false);
           return;
        }

        let currentContent = generatedContent;
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

        for (const match of matches) {
           const originalTag = match[0];
           const promptText = match[1];
           
           try {
             const generatingTag = `<figure class="my-6 p-6 bg-blue-50 border border-blue-200 border-dashed rounded-xl flex flex-col items-center justify-center animate-pulse"><div class="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-3"></div><p class="text-sm font-medium text-blue-700">Generating AI Visual Aid: <em>${promptText}</em></p></figure>`;
             currentContent = currentContent.replace(originalTag, generatingTag);
             setGeneratedContent(currentContent);

             const response = await ai.models.generateContent({
               model: 'gemini-2.5-flash-image',
               contents: { parts: [{ text: `A clean, professional, high-quality educational textbook illustration or diagram on a pure white background. Concept: ` + promptText }] },
               config: { imageConfig: { aspectRatio: "16:9" } }
             });
             
             let imageUrl = '';
             for (const part of response.candidates?.[0]?.content?.parts || []) {
               if (part.inlineData) {
                 const base64EncodeString = part.inlineData.data;
                 imageUrl = `data:${part.inlineData?.mimeType || 'image/jpeg'};base64,${base64EncodeString}`;
                 break;
               }
             }
             
             if (imageUrl) {
               const replacement = `<figure class="my-6 ai-generated-image"><img src="${imageUrl}" alt="${promptText}" class="w-full rounded-xl shadow-sm border border-border" referrerPolicy="no-referrer" /><figcaption class="text-xs text-text-muted mt-2 font-medium text-center max-w-lg mx-auto leading-relaxed">${promptText}</figcaption></figure>`;
               currentContent = currentContent.replace(generatingTag, replacement);
             } else {
               currentContent = currentContent.replace(generatingTag, `<figure class="my-6 p-4 bg-gray-50 border border-dashed border-gray-300 text-center text-sm text-gray-500 rounded-lg"><em>Image unavailable for: ${promptText}</em></figure>`);
             }
           } catch (e) {
             console.error('Image generation error:', e);
             currentContent = currentContent.replace(/<figure class="my-6 p-6 bg-blue-50[^>]*>.*?<\/figure>/s, `<figure class="my-6 p-4 bg-red-50 border border-dashed border-red-200 text-center text-sm text-red-500 rounded-lg"><em>Failed to generate image for: ${promptText}</em></figure>`);
           }
           setGeneratedContent(currentContent);
        }
        setIsGeneratingImages(false);
      };
      
      fetchImages();
    }
  }, [isGenerating, generatedContent, isGeneratingImages, isQuizMode, isRevisionMode]);

  const handleExportHTML = () => {
    const htmlString = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${activeChapter.name} - EduPro Export</title>
  <style>
    body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; line-height: 1.6; max-width: 800px; margin: 0 auto; padding: 2rem; color: #1e293b; background: white; }
    h1, h2, h3 { color: #0f172a; margin-top: 2rem; margin-bottom: 1rem; }
    p, ul, ol { margin-bottom: 1rem; }
    ul { list-style-type: disc; padding-left: 1.5rem; }
    .key-term { background-color: #fef3c7; color: #78350f; padding: 0.125rem 0.375rem; border-radius: 0.25rem; font-weight: bold; border: 1px solid #fde68a; display: inline-block; }
    .definition-box { background-color: #eff6ff; border-left: 4px solid #3b82f6; padding: 1rem; margin: 1rem 0; border-radius: 0 0.5rem 0.5rem 0; color: #1e3a8a; }
    .formula-box { background-color: #ecfdf5; border: 1px solid #a7f3d0; color: #064e3b; padding: 1rem; margin: 1rem 0; border-radius: 0.75rem; font-family: monospace; text-align: center; overflow-x: auto; font-size: 1.125rem; }
    .table-wrapper { overflow-x: auto; margin: 1.5rem 0; border-radius: 0.75rem; border: 1px solid #e2e8f0; }
    table { width: 100%; border-collapse: collapse; }
    th { background-color: #eff6ff; color: #1e40af; font-weight: bold; padding: 0.75rem 1rem; text-align: left; border-bottom: 1px solid #e2e8f0; }
    td { padding: 0.75rem 1rem; border-bottom: 1px solid #e2e8f0; }
    tr:nth-child(even) { background-color: #f8fafc; }
    details { margin-bottom: 1rem; border: 1px solid #e2e8f0; border-radius: 0.5rem; background: white; }
    summary { font-weight: 600; padding: 1rem; background: #f8fafc; cursor: pointer; }
    details[open] summary { border-bottom: 1px solid #e2e8f0; }
    details > div { padding: 1rem; }
  </style>
</head>
<body>
  <div style="border-bottom: 2px solid #e2e8f0; padding-bottom: 1rem; margin-bottom: 2rem;">
    <h1 style="margin:0; color:#1e40af;">EduPro Export</h1>
    <p style="margin:0; color:#64748b;">${activeData.name} - ${activeChapter.name}</p>
  </div>
  <div>
    ${generatedContent ? generatedContent.replace(/```html|```/gi, '') : activeData.preview.intro}
  </div>
</body>
</html>`;

    const blob = new Blob([htmlString], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `EduPro_${activeChapter.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(generatedContent || activeData.preview.intro);
      alert('Content copied to clipboard for sharing!');
    } catch(err) {
      alert('Failed to copy content.');
    }
  };

  const handleGenerate = async (promptTitle: string, promptDesc: string) => {
    setIsGenerating(true);
    setGeneratedContent('');
    setIsEditing(false);
    setIsRevisionMode(false);
    setIsQuizMode(false);
    setShowDashboard(false);
    
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const query = `You are an expert CBSE Class 10 tutor. 
Generate content for the following request:
Subject: ${activeData.name}
Chapter: ${activeChapter.name}
Prompt Task: ${promptTitle}
Description/Requirements: ${promptDesc}

Formatting rules:
- Format the response ENTIRELY in valid HTML5. DO NOT output any Markdown (no *, no #, no $).
- Wrap the entire response in a clean, semantic HTML structure using <article>, <section>, <h1>, <h2>, <h3>, <p>, <ul>, <li>, <strong>, <em>.
- IMPORTANT HIGHLIGHTS (Must Follow):
  1. For Key Terms/Vocabulary: Wrap them in <strong class="key-term">...</strong>
  2. For Definitions/Explanations: Wrap them in <div class="definition-box">...</div>
  3. For Mathematical/Chemistry Formulas: Wrap them in <div class="formula-box">...</div>
  4. VERY IMPORTANT: For highly complex topics, spatial concepts, or crucial visual diagrams in this chapter (at least 2 per output), include an AI image placeholder by writing EXACTLY THIS TAG:
     <div class="ai-image-placeholder" data-prompt="Highly descriptive prompt for an educational illustration or infographic, avoiding text, focusing on clear visual structure"></div>
- For Tables: ALWAYS wrap any <table> in <div class="table-wrapper">...</div>. Use standard <thead>, <tbody>, <tr>, <th>, <td> tags inside.
- For mathematical equations, write them in plain text or use HTML sub/sup tags (e.g., H<sub>2</sub>O or x<sup>2</sup>) and proper HTML entities (&pi;, &theta; etc). NEVER USE $ or markdown math tags.
- If the prompt requires a "Cover and test layout" or "Cornell Recall", you MUST use the HTML5 <details> and <summary> tags heavily.
- Do NOT output any \`\`\`html code blocks. Just output the raw HTML string directly, as it will be injected straight into the DOM.
- Adhere to NCERT textbook terminology.
- Make it visually scan-friendly with short paragraphs and distinct sections.`;

      const responseStream = await ai.models.generateContentStream({
        model: 'gemini-2.5-flash',
        contents: query,
      });

      let fullText = '';
      for await (const chunk of responseStream) {
        fullText += chunk.text;
        setGeneratedContent(fullText);
      }
    } catch (error) {
      console.error(error);
      setGeneratedContent('**Error generating content.** Please check your console or try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-bg text-text-dark font-sans print:h-auto print:bg-white print:overflow-visible">
      {/* Layout Grid */}
      <div className="flex flex-grow w-full overflow-hidden grid-cols-[320px_1fr] md:grid print:block print:overflow-visible">
        {/* Sidebar */}
        <aside className="bg-card border-r border-border flex flex-col w-[320px] shrink-0 hidden md:flex print:hidden">
          <div className="h-16 px-6 border-b border-border flex justify-between items-center shrink-0">
            <div className="font-extrabold text-xl text-primary flex items-center gap-2">
              EDU<span className="text-text-dark">PRO</span>
            </div>
            {user ? (
              <button title="Sign Out" onClick={logout} className="text-text-muted hover:text-text-dark transition-colors">
                <LogOut className="w-4 h-4" />
              </button>
            ) : (
              <button title="Sign In" onClick={login} className="text-primary hover:text-blue-700 transition-colors flex items-center gap-1 text-sm font-semibold">
                <LogIn className="w-4 h-4" /> Sign In
              </button>
            )}
          </div>
          
          <div className="p-6 flex flex-col gap-6 flex-1 overflow-hidden">
            <div className="space-y-4 shrink-0">
              <div>
                <label className="text-[11px] uppercase tracking-wider text-text-muted mb-2 block font-semibold">
                  Curriculum Subject
                </label>
                <div className="relative">
                  <select 
                    value={activeSubjectId}
                    onChange={(e) => handleSubjectChange(e.target.value as keyof typeof subjectsData)}
                    className="w-full appearance-none bg-white border border-border text-text-dark text-sm rounded-lg pl-3 pr-8 py-2 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary cursor-pointer hover:bg-gray-50 transition-colors shadow-sm"
                  >
                    {Object.values(subjectsData).map(sub => (
                      <option key={sub.id} value={sub.id}>{sub.name}</option>
                    ))}
                  </select>
                  <ChevronDown className="w-4 h-4 text-text-muted absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>

              <div>
                <label className="text-[11px] uppercase tracking-wider text-text-muted mb-2 block font-semibold">
                  Chapter Selection
                </label>
                <div className="relative">
                  <select 
                    value={activeChapterId}
                    onChange={(e) => {
                      setActiveChapterId(e.target.value);
                      setGeneratedContent(null);
                    }}
                    className="w-full appearance-none bg-white border border-border text-text-dark text-sm rounded-lg pl-3 pr-8 py-2 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary cursor-pointer hover:bg-gray-50 transition-colors shadow-sm truncate"
                  >
                    {activeData.chapters.map(chap => (
                      <option key={chap.id} value={chap.id}>{chap.name}</option>
                    ))}
                  </select>
                  <ChevronDown className="w-4 h-4 text-text-muted absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>
            </div>

            <div className="h-px bg-border w-full opacity-50 shrink-0"></div>

            <div className="flex flex-col flex-1 overflow-hidden">
               <label className="text-[11px] uppercase tracking-wider text-text-muted mb-3 block font-semibold shrink-0">
                 Generation Prompts
               </label>
               <div className="flex flex-col gap-3 overflow-y-auto custom-scrollbar flex-1 pb-4 pr-1">
                 {activeData.prompts.map((prompt, idx) => {
                   const PromptIcon = prompt.icon;
                   return (
                     <div 
                       key={idx} 
                       onClick={() => handleGenerate(prompt.title, prompt.desc)}
                       className={`bg-white border p-3 rounded-xl flex items-start gap-3 cursor-pointer transition-all duration-200 group ${
                         isGenerating 
                           ? 'opacity-50 pointer-events-none border-border' 
                           : 'border-border hover:border-primary hover:shadow-sm'
                       }`}
                     >
                       <div className="w-8 h-8 rounded-lg bg-primary-light text-primary flex items-center justify-center shrink-0 mt-0.5 group-hover:bg-primary group-hover:text-white transition-colors">
                         <PromptIcon className="w-4 h-4" />
                       </div>
                       <div>
                         <div className="text-[13px] font-semibold text-text-dark mb-0.5 leading-tight group-hover:text-primary transition-colors">{prompt.title}</div>
                         <div className="text-[11px] text-text-muted leading-snug">{prompt.desc}</div>
                       </div>
                     </div>
                   );
                 })}
               </div>
            </div>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex flex-col overflow-hidden w-full h-full bg-bg print:bg-white print:p-0 print:block print:overflow-visible">
          {/* Header */}
          <header className="h-16 bg-card border-b border-border flex items-center justify-between px-6 shrink-0 print:hidden relative z-10">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-primary-light text-primary rounded-lg flex items-center justify-center shrink-0">
                <activeData.icon className="w-4 h-4" />
              </div>
              <div className="font-semibold text-text-dark text-[15px] truncate max-w-[300px] sm:max-w-md">
                {activeData.name} <span className="opacity-40 font-normal">/</span> {activeChapter.name}
              </div>
            </div>
            
            <div className="flex items-center gap-3 text-sm text-text-dark">
              {user && (
                <button 
                  onClick={() => setShowDashboard(!showDashboard)} 
                  className={`px-3 py-1.5 rounded font-medium transition-colors ${showDashboard ? 'bg-primary text-white' : 'text-primary hover:bg-primary/10'}`}
                >
                  My Progress
                </button>
              )}
              <span className="hidden sm:inline">{user ? user.displayName : 'Guest User'}</span>
              {user?.photoURL ? (
                <img src={user.photoURL} alt="User" referrerPolicy="no-referrer" className="w-8 h-8 rounded-full shadow-sm" />
              ) : (
                <div className="w-8 h-8 bg-primary text-white rounded-full flex items-center justify-center font-semibold shrink-0">
                  {user ? (user.displayName ? user.displayName.charAt(0) : 'U') : 'G'}
                </div>
              )}
            </div>
          </header>

          <div className="p-4 md:p-6 flex flex-col flex-1 overflow-hidden print:p-0 print:overflow-visible relative">
            {/* Dashboard Overlay */}
            {showDashboard && user ? (
               <div className="absolute inset-0 z-20 bg-bg overflow-y-auto w-full h-full">
                 <ProgressDashboard user={user} />
               </div>
            ) : null}

            {/* Preview Area */}
            <div className="bg-card rounded-xl border border-border flex flex-col overflow-hidden shadow-sm flex-1 print:border-none print:shadow-none print:w-full print:mb-0 print:print-breakout">
              {/* Preview Header */}
              <div className="px-5 py-3 border-b border-border bg-[#fafafa] flex flex-wrap gap-x-6 gap-y-2 text-[13px] text-text-muted shrink-0 print:hidden sticky top-0 z-10">
                <span className="font-semibold text-text-dark flex items-center">
                  <div className={`w-2 h-2 rounded-full mr-2 ${isGenerating ? 'bg-amber-400 animate-pulse' : isGeneratingImages ? 'bg-blue-400 animate-pulse' : generatedContent ? 'bg-accent' : 'bg-gray-300'}`}></div>
                  {isGenerating ? 'Drafting...' : isGeneratingImages ? 'Drafting Visuals...' : generatedContent ? 'AI Generated Content' : 'Preview Example'}
                </span>
                <div className="flex gap-4 ml-auto">
                  <span 
                    onClick={() => {
                      if (!generatedContent) return;
                      setIsRevisionMode(!isRevisionMode);
                      setIsQuizMode(false);
                      setIsEditing(false);
                    }}
                    className={`cursor-pointer transition-colors flex items-center gap-1.5 ${!generatedContent ? 'opacity-40 cursor-not-allowed' : 'hover:text-text-dark'} ${isRevisionMode ? 'text-primary font-medium' : ''}`}
                  >
                    <Library className="w-3.5 h-3.5" /> Flashcards
                  </span>
                  <span 
                    onClick={() => {
                      if (!generatedContent) return;
                      setIsQuizMode(!isQuizMode);
                      setIsRevisionMode(false);
                      setIsEditing(false);
                    }}
                    className={`cursor-pointer transition-colors flex items-center gap-1.5 ${!generatedContent ? 'opacity-40 cursor-not-allowed' : 'hover:text-text-dark'} ${isQuizMode ? 'text-primary font-medium' : ''}`}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" /> Quiz
                  </span>
                  <span 
                    onClick={() => {
                      if (!generatedContent) return;
                      setIsEditing(!isEditing);
                      setIsRevisionMode(false);
                      setIsQuizMode(false);
                    }}
                    className={`cursor-pointer transition-colors ${!generatedContent ? 'opacity-40 cursor-not-allowed' : 'hover:text-text-dark'} ${isEditing ? 'text-primary font-medium' : ''}`}
                  >
                    {isEditing ? 'Done Editing' : 'Edit Mode'}
                  </span>
                  <span onClick={handleExportHTML} className="cursor-pointer hover:text-text-dark transition-colors flex items-center gap-1.5"><FileCode className="w-3.5 h-3.5" /> Export HTML</span>
                  <span onClick={handleShare} className="cursor-pointer hover:text-text-dark transition-colors flex items-center gap-1.5"><ClipboardList className="w-3.5 h-3.5" /> Copy Output</span>
                </div>
              </div>

            {/* Preview Body */}
            <div className="p-8 overflow-y-auto w-full max-w-none relative print:p-0 print:overflow-visible">
              {isGenerating && (
                <div className="absolute inset-0 bg-white/60 backdrop-blur-[1px] flex items-center justify-center z-10 min-h-[200px]">
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-8 h-8 rounded-full border-4 border-primary border-t-transparent animate-spin"></div>
                    <span className="text-sm font-semibold text-primary">Generating CBSE Content...</span>
                  </div>
                </div>
              )}
              
              <div className="max-w-[750px] mx-auto print:max-w-none print:mx-0 w-full h-full">
                {generatedContent !== null ? (
                  isRevisionMode ? (
                    <FlashcardRevision htmlContent={generatedContent} onExit={() => setIsRevisionMode(false)} user={user} chapterId={activeChapterId} />
                  ) : isQuizMode ? (
                    <InteractiveQuiz htmlContent={generatedContent} onExit={() => setIsQuizMode(false)} user={user} chapterId={activeChapterId} />
                  ) : isEditing ? (
                    <textarea 
                       className="w-full h-[500px] p-4 text-sm font-mono border border-border rounded-lg outline-none focus:border-primary resize-none bg-[#f8fafc]"
                       value={generatedContent}
                       onChange={(e) => setGeneratedContent(e.target.value)}
                    />
                  ) : (
                    <div 
                      className="prose prose-sm md:prose-base prose-slate max-w-none 
                      prose-headings:text-text-dark prose-headings:font-bold prose-headings:tracking-tight
                      prose-h2:mt-8 prose-h2:mb-4
                      prose-p:text-text-muted prose-p:leading-[1.6] 
                      prose-a:text-primary prose-a:no-underline hover:prose-a:underline 
                      prose-strong:font-semibold prose-strong:text-text-dark 
                      prose-blockquote:border-l-4 prose-blockquote:border-primary prose-blockquote:pl-4 prose-blockquote:italic prose-blockquote:text-text-muted prose-blockquote:bg-primary-light/30 prose-blockquote:py-1
                      prose-ul:pl-5 prose-ol:pl-5 prose-li:text-text-muted prose-li:marker:text-primary
                      [&>details]:mb-4 [&>details]:border [&>details]:border-border [&>details]:rounded-lg [&>details]:bg-white [&>details]:shadow-sm
                      [&>details>summary]:font-semibold [&>details>summary]:text-text-dark [&>details>summary]:cursor-pointer [&>details>summary]:p-4 [&>details>summary]:bg-[#fafafa] [&>details>summary]:hover:bg-gray-100 [&>details>summary]:transition-colors [&>details>summary]:rounded-t-lg
                      [&>details[open]>summary]:border-b [&>details[open]>summary]:border-border
                      [&>details>div]:p-4 [&>details>p]:p-4 [&>details>ul]:mx-4 print:[&>details]:break-inside-avoid print:[&>details[open]]:block"
                      dangerouslySetInnerHTML={{ __html: generatedContent.replace(/```html|```/gi, '') }}
                    />
                  )
                ) : (
                  <div className="mt-4">
                    <div className="text-xs text-accent uppercase font-bold mb-2 tracking-wide">{activeData.preview.chapter}</div>
                    <div className="text-3xl font-extrabold mb-4 tracking-tight text-text-dark">{activeData.preview.concept}</div>
                    <p className="text-text-muted mb-6 leading-[1.6]">
                      {activeData.preview.intro}
                    </p>
                    <div className="bg-primary-light/30 rounded-xl p-5 border border-primary/10">
                      <div className="text-sm font-semibold text-primary mb-4">Example Structure</div>
                      <div className="space-y-4">
                        {activeData.preview.bullets.map((bullet, idx) => (
                          <div key={idx} className="flex gap-3 text-[15px] leading-[1.6]">
                            <div className="w-1.5 h-1.5 bg-primary rounded-full mt-2 shrink-0"></div>
                            <div className="text-text-muted"><strong className="text-text-dark">{bullet.strong}</strong> {bullet.text}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                    
                    <div className="mt-10 flex flex-col items-center justify-center p-8 border-2 border-dashed border-border rounded-xl text-center">
                      <div className="w-12 h-12 bg-bg rounded-full flex items-center justify-center mb-3">
                         <Target className="w-5 h-5 text-text-muted" />
                      </div>
                      <h3 className="text-sm font-bold text-text-dark mb-1">Ready to Generator Content</h3>
                      <p className="text-xs text-text-muted max-w-[250px]">Select a Prompt from the left sidebar to generate structured study material for {activeChapter.name}.</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
