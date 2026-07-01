#!/usr/bin/env python3
"""
Boro & Nest Backend API Test Suite - ITERATION 2
Tests new features: file upload, board portal share tokens, Resend emails, admin user
"""
import requests
import json
import io
from typing import Dict, Optional

# Base URL from environment
BASE_URL = "https://boro-gmp.preview.emergentagent.com/api"

class TestSession:
    """Manages test user sessions with cookies and tokens"""
    def __init__(self, name: str):
        self.name = name
        self.email = None
        self.token = None
        self.cookies = {}
        self.user_data = None
        self.role = None
    
    def headers(self, use_bearer: bool = False) -> Dict[str, str]:
        """Get headers for authenticated requests"""
        h = {"Content-Type": "application/json"}
        if use_bearer and self.token:
            h["Authorization"] = f"Bearer {self.token}"
        return h
    
    def get_cookies(self) -> Dict[str, str]:
        """Get cookies for authenticated requests"""
        return self.cookies if self.cookies else {}

def print_test(msg: str):
    """Print test step"""
    print(f"\n{'='*80}")
    print(f"TEST: {msg}")
    print('='*80)

def print_success(msg: str):
    """Print success message"""
    print(f"✅ SUCCESS: {msg}")

def print_error(msg: str):
    """Print error message"""
    print(f"❌ ERROR: {msg}")

def print_info(msg: str):
    """Print info message"""
    print(f"ℹ️  INFO: {msg}")

# ============= TEST 1: ADMIN USER =============
def test_admin_user():
    """Test that admin@boroandnestnyc.com is seeded with isStaff=true"""
    print_test("ADMIN USER - Verify seeded admin with isStaff=true")
    
    admin_session = TestSession("admin")
    
    print("\n--- 1.1: Login as admin@boroandnestnyc.com ---")
    try:
        resp = requests.post(f"{BASE_URL}/auth/login", json={
            "email": "admin@boroandnestnyc.com"
        })
        print(f"Status: {resp.status_code}")
        if resp.status_code == 200:
            data = resp.json()
            admin_session.email = "admin@boroandnestnyc.com"
            admin_session.token = data.get("token")
            admin_session.user_data = data.get("user")
            if 'Set-Cookie' in resp.headers:
                cookie_header = resp.headers['Set-Cookie']
                if 'bn_token=' in cookie_header:
                    token_val = cookie_header.split('bn_token=')[1].split(';')[0]
                    admin_session.cookies = {"bn_token": token_val}
            print_success(f"Admin login successful")
        else:
            print_error(f"Admin login failed: {resp.text}")
            return False, None
    except Exception as e:
        print_error(f"Admin login exception: {e}")
        return False, None
    
    print("\n--- 1.2: GET /api/auth/me (verify isStaff=true) ---")
    try:
        resp = requests.get(
            f"{BASE_URL}/auth/me",
            headers=admin_session.headers(use_bearer=True)
        )
        print(f"Status: {resp.status_code}")
        if resp.status_code == 200:
            data = resp.json()
            user = data.get('user', {})
            is_staff = user.get('isStaff', False)
            if is_staff:
                print_success(f"Admin user has isStaff=true ✅")
                print_info(f"Admin email: {user.get('email')}")
                print_info(f"Admin name: {user.get('name')}")
                return True, admin_session
            else:
                print_error(f"Admin user does NOT have isStaff=true")
                return False, None
        else:
            print_error(f"/me failed: {resp.text}")
            return False, None
    except Exception as e:
        print_error(f"/me exception: {e}")
        return False, None

# ============= TEST 2: FILE UPLOAD =============
def test_file_upload(admin_session: TestSession):
    """Test file upload with size validation"""
    print_test("FILE UPLOAD - Upload files with size validation")
    
    # Test 2.1: Upload a small document
    print("\n--- 2.1: POST /api/upload (small PDF document) ---")
    try:
        # Create a small fake PDF file
        fake_pdf = b"%PDF-1.4\n%Test PDF content\n%%EOF"
        files = {
            'file': ('test-contract.pdf', io.BytesIO(fake_pdf), 'application/pdf')
        }
        data = {
            'projectId': 'proj-lume-cafe',
            'kind': 'document',
            'category': 'Contracts'
        }
        
        resp = requests.post(
            f"{BASE_URL}/upload",
            files=files,
            data=data,
            headers={"Authorization": f"Bearer {admin_session.token}"}
        )
        print(f"Status: {resp.status_code}")
        if resp.status_code == 200:
            result = resp.json()
            if 'url' in result and 'document' in result:
                print_success(f"Document uploaded: {result['url']}")
                print_info(f"Document ID: {result['document']['id']}")
                uploaded_url = result['url']
            else:
                print_error(f"Response missing url or document: {result}")
                return False
        else:
            print_error(f"Upload failed: {resp.text}")
            return False
    except Exception as e:
        print_error(f"Upload exception: {e}")
        return False
    
    # Test 2.2: Upload a photo
    print("\n--- 2.2: POST /api/upload (photo) ---")
    try:
        # Create a small fake PNG
        fake_png = b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00\x05\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82'
        files = {
            'file': ('progress-photo.png', io.BytesIO(fake_png), 'image/png')
        }
        data = {
            'projectId': 'proj-lume-cafe',
            'kind': 'photo',
            'caption': 'Construction progress week 5'
        }
        
        resp = requests.post(
            f"{BASE_URL}/upload",
            files=files,
            data=data,
            headers={"Authorization": f"Bearer {admin_session.token}"}
        )
        print(f"Status: {resp.status_code}")
        if resp.status_code == 200:
            result = resp.json()
            if 'url' in result and 'photo' in result:
                print_success(f"Photo uploaded: {result['url']}")
                print_info(f"Photo ID: {result['photo']['id']}")
            else:
                print_error(f"Response missing url or photo: {result}")
                return False
        else:
            print_error(f"Photo upload failed: {resp.text}")
            return False
    except Exception as e:
        print_error(f"Photo upload exception: {e}")
        return False
    
    # Test 2.3: Upload insurance file (no DB record, just URL)
    print("\n--- 2.3: POST /api/upload (insurance kind) ---")
    try:
        fake_pdf = b"%PDF-1.4\n%Insurance doc\n%%EOF"
        files = {
            'file': ('insurance-cert.pdf', io.BytesIO(fake_pdf), 'application/pdf')
        }
        data = {
            'projectId': 'proj-lume-cafe',
            'kind': 'insurance'
        }
        
        resp = requests.post(
            f"{BASE_URL}/upload",
            files=files,
            data=data,
            headers={"Authorization": f"Bearer {admin_session.token}"}
        )
        print(f"Status: {resp.status_code}")
        if resp.status_code == 200:
            result = resp.json()
            if 'url' in result and 'filename' in result:
                print_success(f"Insurance file uploaded: {result['url']}")
                print_info(f"Filename: {result['filename']}")
            else:
                print_error(f"Response missing url or filename: {result}")
                return False
        else:
            print_error(f"Insurance upload failed: {resp.text}")
            return False
    except Exception as e:
        print_error(f"Insurance upload exception: {e}")
        return False
    
    # Test 2.4: Try uploading file >25MB (should fail)
    print("\n--- 2.4: POST /api/upload (>25MB file - should reject) ---")
    try:
        # Create a 26MB fake file
        large_file = b'X' * (26 * 1024 * 1024)
        files = {
            'file': ('large-file.pdf', io.BytesIO(large_file), 'application/pdf')
        }
        data = {
            'projectId': 'proj-lume-cafe',
            'kind': 'document',
            'category': 'Contracts'
        }
        
        resp = requests.post(
            f"{BASE_URL}/upload",
            files=files,
            data=data,
            headers={"Authorization": f"Bearer {admin_session.token}"}
        )
        print(f"Status: {resp.status_code}")
        if resp.status_code == 400 or resp.status_code == 413:
            result = resp.json()
            if 'error' in result and '25 MB' in result['error']:
                print_success(f"Large file correctly rejected: {result['error']}")
                return True
            else:
                print_error(f"Expected '25 MB' error message, got: {result}")
                return False
        else:
            print_error(f"Expected 400/413 error, got {resp.status_code}: {resp.text}")
            return False
    except Exception as e:
        print_error(f"Large file test exception: {e}")
        return False

# ============= TEST 3: BOARD PORTAL SHARE TOKEN =============
def test_board_portal(admin_session: TestSession):
    """Test share token creation, public access, and revocation"""
    print_test("BOARD PORTAL SHARE TOKEN - Create, Access, Revoke")
    
    share_token = None
    
    # Test 3.1: Create share token for proj-lume-cafe
    print("\n--- 3.1: POST /api/projects/proj-lume-cafe/share (create token) ---")
    try:
        resp = requests.post(
            f"{BASE_URL}/projects/proj-lume-cafe/share",
            headers=admin_session.headers(use_bearer=True)
        )
        print(f"Status: {resp.status_code}")
        if resp.status_code == 200:
            result = resp.json()
            share_token = result.get('shareToken')
            if share_token:
                print_success(f"Share token created: {share_token}")
            else:
                print_error(f"Response missing shareToken: {result}")
                return False
        else:
            print_error(f"Share token creation failed: {resp.text}")
            return False
    except Exception as e:
        print_error(f"Share token creation exception: {e}")
        return False
    
    # Test 3.2: Access portal via PUBLIC endpoint (no auth)
    print("\n--- 3.2: GET /api/portal/{token} (PUBLIC - no auth) ---")
    try:
        resp = requests.get(f"{BASE_URL}/portal/{share_token}")
        print(f"Status: {resp.status_code}")
        if resp.status_code == 200:
            result = resp.json()
            if 'project' in result and 'milestones' in result and 'documents' in result:
                print_success(f"Portal data retrieved successfully")
                print_info(f"Project: {result['project']['name']}")
                print_info(f"Milestones: {len(result['milestones'])}")
                print_info(f"Documents: {len(result['documents'])}")
                print_info(f"Photos: {len(result.get('photos', []))}")
                print_info(f"Change Orders: {len(result.get('changeOrders', []))}")
            else:
                print_error(f"Portal response missing expected fields: {result.keys()}")
                return False
        else:
            print_error(f"Portal access failed: {resp.text}")
            return False
    except Exception as e:
        print_error(f"Portal access exception: {e}")
        return False
    
    # Test 3.3: Delete/revoke share token
    print("\n--- 3.3: DELETE /api/projects/proj-lume-cafe/share (revoke) ---")
    try:
        resp = requests.delete(
            f"{BASE_URL}/projects/proj-lume-cafe/share",
            headers=admin_session.headers(use_bearer=True)
        )
        print(f"Status: {resp.status_code}")
        if resp.status_code == 200:
            result = resp.json()
            if result.get('ok'):
                print_success(f"Share token revoked")
            else:
                print_error(f"Revoke response missing 'ok': {result}")
                return False
        else:
            print_error(f"Token revocation failed: {resp.text}")
            return False
    except Exception as e:
        print_error(f"Token revocation exception: {e}")
        return False
    
    # Test 3.4: Verify token no longer works
    print("\n--- 3.4: GET /api/portal/{token} (should return 404 after revoke) ---")
    try:
        resp = requests.get(f"{BASE_URL}/portal/{share_token}")
        print(f"Status: {resp.status_code}")
        if resp.status_code == 404:
            print_success(f"Revoked token correctly returns 404")
        else:
            print_error(f"Expected 404, got {resp.status_code}: {resp.text}")
            return False
    except Exception as e:
        print_error(f"Revoked token test exception: {e}")
        return False
    
    # Test 3.5: Test pre-seeded demo token
    print("\n--- 3.5: GET /api/portal/demo-board-portal-425 (pre-seeded token) ---")
    try:
        resp = requests.get(f"{BASE_URL}/portal/demo-board-portal-425")
        print(f"Status: {resp.status_code}")
        if resp.status_code == 200:
            result = resp.json()
            if 'project' in result:
                project = result['project']
                print_success(f"Pre-seeded portal accessible")
                print_info(f"Project: {project['name']}")
                print_info(f"Address: {project['address']}")
                print_info(f"Compliance Type: {project.get('complianceType', 'N/A')}")
                return True
            else:
                print_error(f"Portal response missing project: {result.keys()}")
                return False
        else:
            print_error(f"Pre-seeded portal access failed: {resp.text}")
            return False
    except Exception as e:
        print_error(f"Pre-seeded portal exception: {e}")
        return False

# ============= TEST 4: INVITATIONS WITH RESEND =============
def test_invitations_with_resend(admin_session: TestSession):
    """Test invitations with Resend email integration"""
    print_test("INVITATIONS WITH RESEND - Email sending and auto-accept")
    
    # Test 4.1: Invite a real email (should send email)
    print("\n--- 4.1: POST /api/projects/proj-lume-cafe/invite (real email) ---")
    try:
        resp = requests.post(
            f"{BASE_URL}/projects/proj-lume-cafe/invite",
            headers=admin_session.headers(use_bearer=True),
            json={
                "email": "someone-real@example.com",
                "role": "expediter",
                "message": "We'd like you to join this project as expediter"
            }
        )
        print(f"Status: {resp.status_code}")
        if resp.status_code == 200:
            result = resp.json()
            invite = result.get('invite', {})
            email_sent = result.get('emailSent', False)
            if email_sent and invite.get('status') == 'pending':
                print_success(f"Invitation created with emailSent=true")
                print_info(f"Invite ID: {invite['id']}")
                print_info(f"Status: {invite['status']}")
                print_info(f"Email sent: {email_sent}")
            else:
                print_error(f"Expected emailSent=true and status=pending, got emailSent={email_sent}, status={invite.get('status')}")
                return False
        else:
            print_error(f"Invitation failed: {resp.text}")
            return False
    except Exception as e:
        print_error(f"Invitation exception: {e}")
        return False
    
    # Test 4.2: Invite @boronest.co email (auto-accept, no email)
    print("\n--- 4.2: POST /api/projects/proj-lume-cafe/invite (@boronest.co - auto-accept) ---")
    try:
        # First create a staff user
        staff_email = "admin2@boronest.co"
        resp = requests.post(f"{BASE_URL}/auth/signup", json={
            "email": staff_email,
            "name": "Admin Two",
            "role": "client",
            "phone": "212-555-9999",
            "company": "Boro & Nest"
        })
        if resp.status_code != 200:
            print_error(f"Failed to create staff user: {resp.text}")
            return False
        
        # Now invite them
        resp = requests.post(
            f"{BASE_URL}/projects/proj-lume-cafe/invite",
            headers=admin_session.headers(use_bearer=True),
            json={
                "email": staff_email,
                "role": "client",
                "message": "Staff auto-accept test"
            }
        )
        print(f"Status: {resp.status_code}")
        if resp.status_code == 200:
            result = resp.json()
            invite = result.get('invite', {})
            email_sent = result.get('emailSent', True)  # Should be False
            if not email_sent and invite.get('status') == 'accepted':
                print_success(f"Staff invitation auto-accepted with emailSent=false")
                print_info(f"Invite ID: {invite['id']}")
                print_info(f"Status: {invite['status']}")
                print_info(f"Email sent: {email_sent}")
                return True
            else:
                print_error(f"Expected emailSent=false and status=accepted, got emailSent={email_sent}, status={invite.get('status')}")
                return False
        else:
            print_error(f"Staff invitation failed: {resp.text}")
            return False
    except Exception as e:
        print_error(f"Staff invitation exception: {e}")
        return False

# ============= TEST 5: ACCESS CONTROL FOR SHARE TOKEN =============
def test_share_token_access_control():
    """Test that non-staff, non-owner cannot create share tokens"""
    print_test("SHARE TOKEN ACCESS CONTROL - Non-staff cannot create tokens")
    
    # Create a regular user
    print("\n--- 5.1: Create regular non-staff user ---")
    try:
        resp = requests.post(f"{BASE_URL}/auth/signup", json={
            "email": "regular.user@example.com",
            "name": "Regular User",
            "role": "client",
            "phone": "917-555-1234",
            "company": "Regular Co"
        })
        if resp.status_code == 200:
            data = resp.json()
            regular_token = data.get("token")
            print_success(f"Regular user created")
        else:
            print_error(f"User creation failed: {resp.text}")
            return False
    except Exception as e:
        print_error(f"User creation exception: {e}")
        return False
    
    # Try to create share token (should fail with 403)
    print("\n--- 5.2: POST /api/projects/proj-lume-cafe/share (should return 403) ---")
    try:
        resp = requests.post(
            f"{BASE_URL}/projects/proj-lume-cafe/share",
            headers={"Authorization": f"Bearer {regular_token}", "Content-Type": "application/json"}
        )
        print(f"Status: {resp.status_code}")
        if resp.status_code == 403:
            result = resp.json()
            print_success(f"Non-staff correctly denied: {result.get('error')}")
            return True
        else:
            print_error(f"Expected 403, got {resp.status_code}: {resp.text}")
            return False
    except Exception as e:
        print_error(f"Access control test exception: {e}")
        return False

# ============= TEST 6: SCOPING CALL WITH EMAIL =============
def test_scoping_call_with_email():
    """Test scoping call booking with admin email notification"""
    print_test("SCOPING CALL - Booking with email notification")
    
    print("\n--- 6.1: POST /api/scoping-call (should return 200 quickly) ---")
    try:
        import time
        start_time = time.time()
        
        resp = requests.post(
            f"{BASE_URL}/scoping-call",
            json={
                "fullName": "Sarah Johnson",
                "email": "sarah.johnson@example.com",
                "phone": "212-555-7890",
                "projectType": "LL11 Compliance",
                "address": "123 Park Avenue, New York, NY 10016",
                "timeline": "Urgent - Cycle 10B deadline",
                "budget": "500000",
                "notes": "Co-op board needs QEWI inspection and facade repairs"
            }
        )
        
        elapsed = time.time() - start_time
        print(f"Status: {resp.status_code}")
        print(f"Response time: {elapsed:.2f}s")
        
        if resp.status_code == 200:
            result = resp.json()
            if result.get('ok') and result.get('id'):
                print_success(f"Scoping call booked: {result['id']}")
                if elapsed < 2.0:
                    print_success(f"Response returned quickly ({elapsed:.2f}s) - email sent in background")
                else:
                    print_info(f"Response took {elapsed:.2f}s (acceptable but slower than expected)")
                return True
            else:
                print_error(f"Response missing 'ok' or 'id': {result}")
                return False
        else:
            print_error(f"Scoping call failed: {resp.text}")
            return False
    except Exception as e:
        print_error(f"Scoping call exception: {e}")
        return False

# ============= TEST 7: REGRESSION CHECK =============
def test_regression():
    """Quick regression check of iteration 1 endpoints"""
    print_test("REGRESSION CHECK - Verify iteration 1 still works")
    
    # Test 7.1: Auth signup
    print("\n--- 7.1: POST /api/auth/signup (regression) ---")
    try:
        resp = requests.post(f"{BASE_URL}/auth/signup", json={
            "email": "regression.test@example.com",
            "name": "Regression Test",
            "role": "client",
            "phone": "212-555-0000",
            "company": "Test Co"
        })
        if resp.status_code == 200:
            data = resp.json()
            test_token = data.get("token")
            print_success(f"Auth signup still works")
        else:
            print_error(f"Auth signup failed: {resp.text}")
            return False
    except Exception as e:
        print_error(f"Auth signup exception: {e}")
        return False
    
    # Test 7.2: Projects list
    print("\n--- 7.2: GET /api/projects (regression) ---")
    try:
        resp = requests.get(
            f"{BASE_URL}/projects",
            headers={"Authorization": f"Bearer {test_token}"}
        )
        if resp.status_code == 200:
            data = resp.json()
            projects = data.get('projects', [])
            # Should see 4 demo projects now (including proj-ues-ll11)
            if len(projects) >= 4:
                print_success(f"Projects list still works ({len(projects)} projects)")
                # Verify proj-ues-ll11 is present
                ll11_project = next((p for p in projects if p['id'] == 'proj-ues-ll11'), None)
                if ll11_project:
                    print_info(f"LL11 compliance project visible: {ll11_project['name']}")
                else:
                    print_error(f"proj-ues-ll11 not found in projects list")
                    return False
            else:
                print_error(f"Expected 4+ projects, got {len(projects)}")
                return False
        else:
            print_error(f"Projects list failed: {resp.text}")
            return False
    except Exception as e:
        print_error(f"Projects list exception: {e}")
        return False
    
    # Test 7.3: Project detail
    print("\n--- 7.3: GET /api/projects/proj-ues-ll11 (regression) ---")
    try:
        resp = requests.get(
            f"{BASE_URL}/projects/proj-ues-ll11",
            headers={"Authorization": f"Bearer {test_token}"}
        )
        if resp.status_code == 200:
            data = resp.json()
            project = data.get('project')
            if project and 'milestones' in data and 'documents' in data:
                print_success(f"Project detail still works: {project['name']}")
                return True
            else:
                print_error(f"Project detail missing expected fields")
                return False
        else:
            print_error(f"Project detail failed: {resp.text}")
            return False
    except Exception as e:
        print_error(f"Project detail exception: {e}")
        return False

# ============= MAIN TEST RUNNER =============
def main():
    """Run all iteration 2 backend tests"""
    print("\n" + "="*80)
    print("BORO & NEST BACKEND API TEST SUITE - ITERATION 2")
    print("="*80)
    print(f"Base URL: {BASE_URL}")
    print("="*80)
    
    results = {
        "admin_user": False,
        "file_upload": False,
        "board_portal": False,
        "invitations_resend": False,
        "share_access_control": False,
        "scoping_call_email": False,
        "regression": False
    }
    
    # Test 1: Admin User
    admin_result = test_admin_user()
    if admin_result[0]:
        results["admin_user"] = True
        admin_session = admin_result[1]
    else:
        print_error("ADMIN USER TEST FAILED - Cannot continue with file upload and portal tests")
        return results
    
    # Test 2: File Upload
    if test_file_upload(admin_session):
        results["file_upload"] = True
    
    # Test 3: Board Portal
    if test_board_portal(admin_session):
        results["board_portal"] = True
    
    # Test 4: Invitations with Resend
    if test_invitations_with_resend(admin_session):
        results["invitations_resend"] = True
    
    # Test 5: Share Token Access Control
    if test_share_token_access_control():
        results["share_access_control"] = True
    
    # Test 6: Scoping Call with Email
    if test_scoping_call_with_email():
        results["scoping_call_email"] = True
    
    # Test 7: Regression
    if test_regression():
        results["regression"] = True
    
    # Print summary
    print("\n" + "="*80)
    print("TEST SUMMARY - ITERATION 2")
    print("="*80)
    for test_name, passed in results.items():
        status = "✅ PASS" if passed else "❌ FAIL"
        print(f"{test_name.upper().replace('_', ' ')}: {status}")
    
    total = len(results)
    passed = sum(1 for v in results.values() if v)
    print(f"\nTotal: {passed}/{total} tests passed")
    print("="*80)
    
    return results

if __name__ == "__main__":
    main()
