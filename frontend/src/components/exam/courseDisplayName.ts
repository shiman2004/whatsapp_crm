type CourseNameSource = {
  courseCode?: string;
  courseName?: string;
  profession?: string;
};

/** User-facing title overrides for legacy course records. */
export function displayCourseName(course: CourseNameSource): string {
  if (course.courseCode === 'MOH-GP' || course.profession === 'General Practitioner') {
    return 'General Practitioner';
  }
  return course.courseName || course.profession || 'Course';
}
