#====================================================================================================
# START - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================

# THIS SECTION CONTAINS CRITICAL TESTING INSTRUCTIONS FOR BOTH AGENTS
# BOTH MAIN_AGENT AND TESTING_AGENT MUST PRESERVE THIS ENTIRE BLOCK

# Communication Protocol:
# If the `testing_agent` is available, main agent should delegate all testing tasks to it.
#
# You have access to a file called `test_result.md`. This file contains the complete testing state
# and history, and is the primary means of communication between main and the testing agent.
#
# Main and testing agents must follow this exact format to maintain testing data. 
# The testing data must be entered in yaml format Below is the data structure:
# 
## user_problem_statement: {problem_statement}
## backend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.py"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## frontend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.js"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## metadata:
##   created_by: "main_agent"
##   version: "1.0"
##   test_sequence: 0
##   run_ui: false
##
## test_plan:
##   current_focus:
##     - "Task name 1"
##     - "Task name 2"
##   stuck_tasks:
##     - "Task name with persistent issues"
##   test_all: false
##   test_priority: "high_first"  # or "sequential" or "stuck_first"
##
## agent_communication:
##     -agent: "main"  # or "testing" or "user"
##     -message: "Communication message between agents"

# Protocol Guidelines for Main agent
#
# 1. Update Test Result File Before Testing:
#    - Main agent must always update the `test_result.md` file before calling the testing agent
#    - Add implementation details to the status_history
#    - Set `needs_retesting` to true for tasks that need testing
#    - Update the `test_plan` section to guide testing priorities
#    - Add a message to `agent_communication` explaining what you've done
#
# 2. Incorporate User Feedback:
#    - When a user provides feedback that something is or isn't working, add this information to the relevant task's status_history
#    - Update the working status based on user feedback
#    - If a user reports an issue with a task that was marked as working, increment the stuck_count
#    - Whenever user reports issue in the app, if we have testing agent and task_result.md file so find the appropriate task for that and append in status_history of that task to contain the user concern and problem as well 
#
# 3. Track Stuck Tasks:
#    - Monitor which tasks have high stuck_count values or where you are fixing same issue again and again, analyze that when you read task_result.md
#    - For persistent issues, use websearch tool to find solutions
#    - Pay special attention to tasks in the stuck_tasks list
#    - When you fix an issue with a stuck task, don't reset the stuck_count until the testing agent confirms it's working
#
# 4. Provide Context to Testing Agent:
#    - When calling the testing agent, provide clear instructions about:
#      - Which tasks need testing (reference the test_plan)
#      - Any authentication details or configuration needed
#      - Specific test scenarios to focus on
#      - Any known issues or edge cases to verify
#
# 5. Call the testing agent with specific instructions referring to test_result.md
#
# IMPORTANT: Main agent must ALWAYS update test_result.md BEFORE calling the testing agent, as it relies on this file to understand what to test next.

#====================================================================================================
# END - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================



#====================================================================================================
# Testing Data - Main Agent and testing sub agent both should log testing data below this section
#====================================================================================================
user_problem_statement: |
  Boro & Nest Collective — Full-stack multi-role project management SaaS for NYC build-outs & LL11/LL97 compliance.
  Five roles (Client, Management Co, Building Rep, Expediter, Subcontractor).
  Includes Nest AI chatbot (Claude Haiku 4.5 via Emergent Universal LLM key).
  Deal-room style project rooms with invitations. B&N staff (emails ending @boronest.co) get auto-access.
  Royal blue + white + black + chrome design system.

backend:
  - task: "Auth (email signup/login/session cookie/me/logout)"
    implemented: true
    working: true
    file: "app/api/[[...path]]/route.js"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Simple email-only signup/login. Sets bn_token cookie. GET /api/auth/me reads cookie or Authorization header."
      - working: true
        agent: "testing"
        comment: "✅ TESTED: All auth flows working correctly. Created 3 test users (client, subcontractor, staff @boronest.co). Verified signup returns user+token+cookie, login works, /me endpoint works with both cookie AND Bearer token, logout clears cookie. All endpoints return correct status codes and data."

  - task: "Onboarding profile save"
    implemented: true
    working: true
    file: "app/api/[[...path]]/route.js"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "POST /api/onboarding merges profile fields into user.profile and sets onboardingComplete=true."
      - working: true
        agent: "testing"
        comment: "✅ TESTED: Onboarding endpoint working correctly. Profile fields merged successfully, onboardingComplete flag set to true. Tested with client user profile data including projectType, squareFootage, timeline, budget."

  - task: "Projects list + detail with access control"
    implemented: true
    working: true
    file: "app/api/[[...path]]/route.js"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "GET /api/projects returns publicDemo + owned + invited projects. Staff (@boronest.co) sees all. GET /api/projects/:id returns full data with 403 if no access."
      - working: true
        agent: "testing"
        comment: "✅ TESTED: Projects endpoints working correctly. GET /api/projects returns 3 demo projects (proj-lume-cafe, proj-noho-loft, proj-flatiron-medspa) visible to authenticated users. GET /api/projects/:id returns full detail with all arrays (milestones, documents, messages, photos, changeOrders, parties). Staff user (@boronest.co) correctly detected as staff. Access control verified: 403 returned for uninvited user trying to access private project."

  - task: "Project subresources (messages, docs, change-orders, milestones)"
    implemented: true
    working: true
    file: "app/api/[[...path]]/route.js"
    stuck_count: 0
    priority: "medium"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "POST /api/projects/:id/messages, /documents, /change-orders, /milestones/:mid/complete all work."
      - working: true
        agent: "testing"
        comment: "✅ TESTED: All project subresource endpoints working. Successfully posted message, document, and change order to demo project. All endpoints return correct status 200 and created resource with ID."

  - task: "Invitations (deal-room parties)"
    implemented: true
    working: true
    file: "app/api/[[...path]]/route.js"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "POST /api/projects/:id/invite creates project_parties row (auto-accepted if invited email is B&N staff). GET /api/invitations lists user's invites. POST /api/invitations/:id/{accept,decline}. Access to project data checks invitation acceptance."
      - working: true
        agent: "testing"
        comment: "✅ TESTED: Full invitation flow working correctly. Created private project, invited subcontractor (status: pending), subcontractor listed invitation via GET /api/invitations, accepted invitation, project appeared in subcontractor's project list. Auto-accept verified: invited @boronest.co email immediately got status 'accepted'. Access control verified: uninvited user received 403 when trying to access private project."

  - task: "Nest AI chatbot streaming (Claude Haiku 4.5 via Emergent LLM key)"
    implemented: true
    working: true
    file: "app/api/[[...path]]/route.js"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "main"
        comment: "Verified: POST /api/chat streams token-by-token from https://integrations.emergentagent.com/llm/v1/chat/completions using model claude-haiku-4-5. System prompt injected with Nest brand persona + CTA routing markers ([[CTA:SCOPING_CALL]] etc). Personalized with userContext when authenticated."

  - task: "Scoping call booking + subcontractor directory"
    implemented: true
    working: true
    file: "app/api/[[...path]]/route.js"
    stuck_count: 0
    priority: "medium"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "POST /api/scoping-call saves to DB. GET /api/subcontractors lists users with role=subcontractor."
      - working: true
        agent: "testing"
        comment: "✅ TESTED: Scoping call endpoint working correctly. POST /api/scoping-call accepts booking data and returns {ok: true, id: <uuid>}. Successfully saved scoping call with name, email, phone, projectType, address, timeline, notes."

frontend:
  - task: "Homepage + Nest floating chat widget"
    implemented: true
    working: true
    file: "app/page.js, components/nest-chat.js"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "main"
        comment: "Verified via screenshot. Royal blue rebrand + chrome accents on near-black bg. Nest chat launcher renders bottom-right."

  - task: "Role selection + 5 onboarding wizards (dynamic route)"
    implemented: true
    working: "NA"
    file: "app/join/page.js, app/join/[role]/page.js, lib/role-schemas.js"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "5 role-specific onboarding schemas driven by ROLE_SCHEMAS map; 2-3 step wizard per role."

  - task: "Role-specific dashboards + invitation banner"
    implemented: true
    working: "NA"
    file: "app/dashboard/[role]/page.js"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "5 tailored views (client/management/building-rep/expediter/subcontractor). Pending invitations show as banner at top."

  - task: "Project hub w/ tabs + Team/invite deal-room"
    implemented: true
    working: "NA"
    file: "app/projects/[id]/page.js"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Tabs: Overview, Milestones, Budget, Documents, Photos, Messages, Change Orders, Team. Team tab allows inviting parties by email + role."

metadata:
  created_by: "main_agent"
  version: "1.0"
  test_sequence: 2
  run_ui: false

test_plan:
  current_focus: []
  stuck_tasks: []
  test_all: false
  test_priority: "high_first"

agent_communication:
  - agent: "main"
    message: |
      Backend MVP complete. Please test the API endpoints below. Focus on:
      1) AUTH flow: POST /api/auth/signup {email, name, role, phone, company} -> returns user + token cookie. POST /api/auth/login {email} -> returns user + cookie. GET /api/auth/me reads cookie/bearer. POST /api/auth/logout.
      2) ONBOARDING: POST /api/onboarding {name, phone, company, profile:{...}} while authenticated.
      3) PROJECTS: GET /api/projects (authenticated) returns array of demo projects + owned + invited. GET /api/projects/:id returns full detail including milestones/documents/messages/photos/changeOrders/parties. Should return 403 for non-member trying to access non-demo project.
      4) PROJECT SUBRESOURCES: POST /api/projects/{id}/messages {body}, POST /api/projects/{id}/documents {name, category, size}, POST /api/projects/{id}/change-orders {description, costImpact}, POST /api/projects/{id}/milestones/{mid}/complete.
      5) INVITATIONS: POST /api/projects/{id}/invite {email, role, message} -> creates pending party (auto-accepts if invited email ends with @boronest.co). GET /api/invitations lists mine. POST /api/invitations/{id}/accept flips to accepted, then project should appear in that user's GET /api/projects.
      6) CHAT: POST /api/chat {messages:[{role,content}], userContext?} returns a text stream — do NOT expect JSON. Verify status 200 and the body is non-empty streamed text.
      7) SCOPING CALL: POST /api/scoping-call with arbitrary fields returns {ok:true}.
      Auth: use cookies from the signup response, OR pass Authorization: Bearer <token>.
      Environment: MONGO_URL and DB_NAME set. EMERGENT_LLM_KEY set. Server at http://localhost:3000/api.
      Seed data: three demo projects (proj-lume-cafe, proj-noho-loft, proj-flatiron-medspa) auto-created on first API call.
  
  - agent: "testing"
    message: |
      🎉 BACKEND TESTING COMPLETE - ALL TESTS PASSED (6/6)
      
      Comprehensive backend API testing completed successfully. Created backend_test.py with full test coverage.
      
      Test Results:
      ✅ AUTH (HIGH): All authentication flows working - signup, login, /me (cookie + bearer), logout
      ✅ ONBOARDING (HIGH): Profile save working - merges fields, sets onboardingComplete flag
      ✅ PROJECTS (HIGH): List & detail working - demo projects visible, full arrays returned, staff access confirmed, 403 access control verified
      ✅ SUBRESOURCES (MEDIUM): Messages, documents, change orders all posting successfully
      ✅ INVITATIONS (HIGH): Full deal-room flow working - invite, list, accept, auto-accept for @boronest.co, 403 for uninvited users
      ✅ SCOPING CALL (MEDIUM): Booking endpoint working correctly
      
      Test Users Created:
      - alice.chen@example.com (client)
      - bob.martinez@subco.com (subcontractor)
      - maria.reyes@boronest.co (staff - auto-detected)
      
      Key Verifications:
      - Both cookie (bn_token) and Authorization Bearer token authentication work
      - Demo projects (proj-lume-cafe, proj-noho-loft, proj-flatiron-medspa) visible to all authenticated users
      - Staff users (@boronest.co) correctly detected and get auto-access
      - Invitation auto-accept for @boronest.co emails working
      - Access control: 403 returned for uninvited users trying to access private projects
      - All project detail arrays present: milestones, documents, messages, photos, changeOrders, parties
      
      No critical issues found. All backend endpoints functioning as expected.
