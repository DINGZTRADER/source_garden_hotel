PDC-v1.0-FINAL.md
Source Garden HMS

Production Deployment Checklist — Final

Document Control

System Name: Source Garden HMS

Checklist Version: v1.0 (FINAL)

Related Audit: AUDIT-v1.0-FINAL.md

Deployment Date: ____________________

Approved By: ____________________

1. Deployment Scope Confirmation

☐ System is deployed only for internal hotel operations
☐ Access restricted to hotel-controlled desktop or POS computers
☐ No public or guest access enabled
☐ Deployment matches documented scope in AUDIT-v1.0-FINAL.md

2. Infrastructure & Hosting

☐ Firebase project created and verified
☐ Firestore database enabled in production mode
☐ Hosting deployed successfully
☐ Correct region selected (Africa / nearest region)
☐ Application URL reachable from hotel computers

3. Authentication & Access Control

☐ Firebase Authentication enabled
☐ Anonymous or approved authentication method active
☐ Roles stored and enforced server-side
☐ No hardcoded PINs or client-side role escalation
☐ Admin account verified and tested

4. Firestore Security Rules (CRITICAL)

☐ Firestore rules deployed and active
☐ Least-privilege access enforced
☐ Sales records are append-only
☐ Void records are append-only
☐ Work periods are immutable after closure
☐ Unauthorized delete/update attempts blocked

5. Work Period / Shift Control

☐ Shift opening workflow tested
☐ Sales blocked if no active work period
☐ Shift closing workflow tested
☐ Declared vs expected totals recorded
☐ Closed work periods locked and non-editable
☐ Variance calculations stored permanently

6. POS Core Functionality

☐ POS loads correctly on desktop browser
☐ Menu items display correctly
☐ Item add/remove functions correctly
☐ Payment methods (cash, MoMo, card, room) tested
☐ Receipt totals calculated correctly
☐ POS performance acceptable under load

7. Offline & Power Resilience

☐ POS operates during internet outage
☐ Transactions queue safely when offline
☐ No data loss during power interruption
☐ Automatic sync occurs when connection restores
☐ Offline indicators visible to staff

8. Void & Audit Logging

☐ Item void workflow available
☐ Voids logged with item, quantity, staff, timestamp
☐ Voids cannot be deleted or edited
☐ Audit logs visible to authorized roles only

9. Room Charges & Reconciliation

☐ POS room charges correctly posted
☐ Room charge details visible in guest profile
☐ Checkout reflects full accumulated balance
☐ Room and POS data stay consistent

10. Stock Integrity

☐ Opening stock entered correctly
☐ Sales decrement stock automatically
☐ Closing stock calculated correctly
☐ Manual adjustments restricted to authorized roles
☐ Stock discrepancies traceable

11. Reporting & Daily Closure

☐ Daily financial report generates correctly
☐ Sales, room charges, and expenses included
☐ Reports match closed work periods
☐ Reports are read-only after generation

12. Staff Readiness

☐ Admin trained on reports and shift closure
☐ POS staff trained on daily operations
☐ Front Office trained on room workflows
☐ Staff understand offline behavior and recovery

13. Backup & Recovery

☐ Firebase data retention confirmed
☐ Admin understands recovery procedure
☐ No local-only critical data storage

14. Final Go-Live Authorization

☐ All checklist items completed
☐ AUDIT-v1.0-FINAL.md approved
☐ Management sign-off obtained

GO-LIVE STATUS:
x☐ APPROVED  ☐ NOT APPROVED

Sign-Off

System Owner / Manager:
Name: _Source Garden Hotel Jinja
Signature: _____________________
Date: 08/01/2026

Technical Lead / Deployer:
Name: Peter Wacha
Signature: _____________________
Date: 08/01/2026
End of Document
PDC-v1.0-FINAL.md