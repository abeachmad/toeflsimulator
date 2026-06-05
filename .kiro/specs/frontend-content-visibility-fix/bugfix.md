# Bugfix Requirements Document

## Introduction

This document defines the requirements for fixing a critical frontend display issue where reading passage content and questions are not visible to users despite data loading correctly from the API. The bug affects the reading section's split-screen layout, where the PassageViewer component renders questions on the left and passage text on the right.

**Impact:** Users cannot take reading tests because content is invisible, rendering the reading section completely unusable despite all backend data and frontend logic working correctly.

**Root Cause Analysis:** The LockedQuestionIndicator component applies a full-screen overlay (`absolute inset-0`) with `z-20` that covers both the question content and the passage viewer when the gatekeeper locking mechanism is active. This overlay is intended to prevent interaction with locked questions, but its positioning and z-index cause it to hide ALL content instead of just preventing interaction.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN PassageViewer renders with reading questions AND the gatekeeper is active (passage has content) THEN the system displays only placeholder text ("Passage content will appear here") and questions are not visible on screen, despite data being correctly loaded and parsed

1.2 WHEN LockedQuestionIndicator wraps question content AND isLocked is true THEN the system applies an overlay with `absolute inset-0` and `z-20` that covers the entire question container, hiding all content beneath it

1.3 WHEN passage content is rendered inside PassageViewer's right panel THEN the system displays the passage, but the locked overlay from the question on the left side extends across the entire viewport, obscuring the passage panel

1.4 WHEN debug logs confirm data loading (50 items, correct IDs, parsed content, correct props) THEN the system still shows no visible content to the user, indicating a CSS/layout rendering issue rather than a data problem

### Expected Behavior (Correct)

2.1 WHEN PassageViewer renders with reading questions AND the gatekeeper is active THEN the system SHALL display both the passage content on the right side AND the question content on the left side visibly on screen

2.2 WHEN LockedQuestionIndicator wraps question content AND isLocked is true THEN the system SHALL apply an overlay that prevents interaction with the specific question component ONLY, without hiding the content or affecting the passage viewer on the right side

2.3 WHEN passage content is rendered inside PassageViewer's right panel THEN the system SHALL display the full passage text visibly with proper formatting, independent of the locked state of questions on the left side

2.4 WHEN the gatekeeper locking mechanism is active THEN the system SHALL show a visual lock indicator and prevent user input on locked questions, while maintaining full visibility of both question text and passage text

### Unchanged Behavior (Regression Prevention)

3.1 WHEN the user scrolls the passage to the bottom THEN the system SHALL CONTINUE TO unlock all questions by removing the locked state

3.2 WHEN a question is unlocked (gatekeeper inactive or scroll completed) THEN the system SHALL CONTINUE TO allow full interaction with question inputs (radio buttons, text fields)

3.3 WHEN the user attempts to interact with a locked question THEN the system SHALL CONTINUE TO display a notification message explaining that the passage must be read first

3.4 WHEN PassageViewer receives empty or whitespace-only passage content THEN the system SHALL CONTINUE TO not activate the gatekeeper and allow immediate interaction with questions

3.5 WHEN data is loading from the API THEN the system SHALL CONTINUE TO display a loading spinner with appropriate messaging

3.6 WHEN the API returns an error THEN the system SHALL CONTINUE TO display an error message with a retry button

3.7 WHEN multiple choice options are rendered THEN the system SHALL CONTINUE TO display radio buttons with proper labels (A, B, C, D) and selection state

3.8 WHEN different question types are rendered (complete-words, academic-passage, synonym-match, daily-life) THEN the system SHALL CONTINUE TO parse and display their specific content structures correctly
