// ... existing code ...

import CourseCard from './CourseCard';

function CourseView() {
  return (
    <div>
      <h1>Course View</h1>
      <div className="course-cards">
        {courses.map((course) => (
          <CourseCard key={course.id} course={course} />
        ))}
      </div>
    </div>
  );
}

export default CourseView;