// src/components/StudentDashboard.tsx
// Placeholder body content below the banner — swap in your real widgets.

export default function StudentDashboard() {
  return (
    <section>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">
        Welcome back, Student 👋
      </h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Course card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-700 mb-2">My Courses</h2>
          <p className="text-gray-500 text-sm">View your enrolled courses and syllabi.</p>
        </div>

        {/* Schedule card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-700 mb-2">Schedule</h2>
          <p className="text-gray-500 text-sm">Check today's classes and upcoming deadlines.</p>
        </div>

        {/* Resources card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-700 mb-2">Campus Resources</h2>
          <p className="text-gray-500 text-sm">
            Tutoring, financial aid, advising, and more.
          </p>
        </div>
      </div>
    </section>
  );
}
