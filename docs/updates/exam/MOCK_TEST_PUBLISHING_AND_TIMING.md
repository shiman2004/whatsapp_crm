# Mock Test Publishing and Timing

The active Mock Tests area now includes a **Publish Mock Test** workflow for the selected nurse course.

When publishing, staff can set:

- mock-test title;
- number of questions;
- total exam duration in minutes;
- optional seconds allowed per question (`0` uses only the total countdown); and
- passing score.

The database stores `per_question_seconds`. During the exam, the runner shows both the total countdown and the per-question countdown; when a question timer reaches zero, the runner advances automatically (or submits on the final question).

The current two nurse questions remain draft/inactive until reviewed and approved in **Question Bank**. Review/activate the required questions before publishing a student-facing exam.
