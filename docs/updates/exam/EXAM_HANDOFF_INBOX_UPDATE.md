# Exam Department Handoff Inbox

Implemented the Sales-to-Exam handoff workflow:

1. When a sales user changes a lead Output to **Forwarded to Exam Department**, the CRM creates an auditable `exam-handoff` record and sends an in-app desktop notification to the Exam Department workspace.
2. A Head of Exam Department can accept the handoff.
3. After acceptance, the Head of Exam can assign or reassign it to an Exam Providing Officer.
4. Assigned officers can later start and complete the handoff, leaving a status/history trail.

The Exam Department Operations screen now includes a polling inbox with the pending count, acceptance action, officer selector, assignment status, and refresh control. Staff Management includes **Head of Exam Department** and **Exam Providing Officer** roles.

The Pipeline table horizontal scrollbar is now 16px high with a stronger teal grab handle, making the wide table easier to move across on touch and desktop screens.
