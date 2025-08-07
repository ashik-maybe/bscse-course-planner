// Load courses data using fetch instead of import assertion
async function loadCoursesData() {
    try {
        const response = await fetch('./src/data/courses.json');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        console.error('Error loading courses ', error);
        return []; // Return empty array if loading fails
    }
}

class CoursePlanner {
    constructor(coursesData) {
        this.courses = coursesData;
        this.selectedCourses = new Set();
        this.maxCredits = 14;
        this.maxCourses = 8;
        this.categoryFilter = '';
        this.typeFilter = '';
        this.electiveTrailSelections = {
            firstTrail: null,  // For first 2 electives (6 credits)
            thirdTrail: null   // For third elective (3 credits)
        };

        // Define alternative course groups
        this.alternativeGroups = [
            ['POL101', 'POL104'],           // Political Science alternatives
            ['ECO101', 'ECO104'],           // Economics alternatives
            ['SOC101', 'ANT101', 'ENV203']  // Social Sciences alternatives
        ];

        this.initializeElements();
        this.bindEvents();
        this.loadTheme();
        this.renderCourses();
        this.updateStats();
    }

    initializeElements() {
        this.maxCreditsInput = document.getElementById('maxCredits');
        this.maxCoursesInput = document.getElementById('maxCourses');
        this.searchInput = document.getElementById('searchInput');
        this.clearAllButton = document.getElementById('clearAll');
        this.selectedCreditsElement = document.getElementById('selectedCredits');
        this.selectedCoursesElement = document.getElementById('selectedCourses');
        this.remainingCreditsElement = document.getElementById('remainingCredits');
        this.remainingCoursesElement = document.getElementById('remainingCourses');
        this.selectedCoursesList = document.getElementById('selectedCoursesList');
        this.availableCoursesList = document.getElementById('availableCoursesList');
        this.categoryFilterElement = document.getElementById('categoryFilter');
        this.typeFilterElement = document.getElementById('typeFilter');
        this.themeToggle = document.getElementById('themeToggle');
        this.selectedCountElement = document.getElementById('selectedCount');
        this.semesterCostElement = document.getElementById('semesterCost'); // Cost calculator element
    }

    bindEvents() {
        this.maxCreditsInput.addEventListener('change', (e) => {
            this.maxCredits = parseInt(e.target.value) || 14;
            this.updateStats();
            this.renderCourses();
        });

        this.maxCoursesInput.addEventListener('change', (e) => {
            this.maxCourses = parseInt(e.target.value) || 8;
            this.updateStats();
            this.renderCourses();
        });

        this.searchInput.addEventListener('input', () => {
            this.renderCourses();
        });

        this.clearAllButton.addEventListener('click', () => {
            this.selectedCourses.clear();
            this.electiveTrailSelections = { firstTrail: null, thirdTrail: null };
            this.updateStats();
            this.renderCourses();
        });

        this.categoryFilterElement.addEventListener('change', (e) => {
            this.categoryFilter = e.target.value;
            this.renderCourses();
        });

        this.typeFilterElement.addEventListener('change', (e) => {
            this.typeFilter = e.target.value;
            this.renderCourses();
        });

        this.themeToggle.addEventListener('click', () => {
            this.toggleTheme();
        });
    }

    loadTheme() {
        const savedTheme = localStorage.getItem('theme') || 'light';
        document.documentElement.setAttribute('data-theme', savedTheme);
        this.updateThemeIcon(savedTheme);
    }

    toggleTheme() {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
        this.updateThemeIcon(newTheme);
    }

    updateThemeIcon(theme) {
        const themeIcon = this.themeToggle.querySelector('.theme-icon');
        themeIcon.textContent = theme === 'dark' ? '☀️' : '🌙';
    }

    getSelectedCredits() {
        let total = 0;
        this.selectedCourses.forEach(code => {
            const course = this.courses.find(c => c.code === code);
            if (course) total += course.credits;
        });
        return total;
    }

    getSelectedCourseCount() {
        return this.selectedCourses.size;
    }

    updateStats() {
        const selectedCredits = this.getSelectedCredits();
        const selectedCourses = this.getSelectedCourseCount();
        const remainingCredits = this.maxCredits - selectedCredits;
        const remainingCourses = this.maxCourses - selectedCourses;

        this.selectedCreditsElement.textContent = selectedCredits;
        this.selectedCoursesElement.textContent = selectedCourses;
        this.remainingCreditsElement.textContent = remainingCredits;
        this.remainingCoursesElement.textContent = remainingCourses;
        this.selectedCountElement.textContent = `${selectedCourses} course${selectedCourses !== 1 ? 's' : ''}`;

        // Update cost calculator
        const semesterCost = (selectedCredits * 6500) + 2500 + 3000 + 1500 + 2500; // = (Credits × 6500) + 9500
        this.semesterCostElement.textContent = `৳${semesterCost.toLocaleString()}`;

        // Update warning states
        if (remainingCredits <= 3) {
            this.remainingCreditsElement.classList.add('warning');
        } else {
            this.remainingCreditsElement.classList.remove('warning');
        }

        if (remainingCourses <= 2) {
            this.remainingCoursesElement.classList.add('warning');
        } else {
            this.remainingCoursesElement.classList.remove('warning');
        }
    }

    // Check if selecting a course would violate alternative course rules
    wouldViolateAlternatives(courseCode) {
        // Find which alternative group this course belongs to
        const group = this.alternativeGroups.find(g => g.includes(courseCode));

        if (group) {
            // Check if any alternative course from the same group is already selected
            return group.some(altCode =>
                altCode !== courseCode && this.selectedCourses.has(altCode)
            );
        }

        return false;
    }

    // Get the alternative group for a course
    getAlternativeGroup(courseCode) {
        return this.alternativeGroups.find(g => g.includes(courseCode)) || [];
    }

    isCourseAvailable(course) {
        // Check if course is already selected
        if (this.selectedCourses.has(course.code)) return false;

        // Check credit limit
        const selectedCredits = this.getSelectedCredits();
        if (selectedCredits + course.credits > this.maxCredits) return false;

        // Check course count limit
        const selectedCourses = this.getSelectedCourseCount();
        if (selectedCourses + 1 > this.maxCourses) return false;

        // Check alternative course restrictions
        if (this.wouldViolateAlternatives(course.code)) return false;

        return true;
    }

    addCourse(courseCode) {
        const course = this.courses.find(c => c.code === courseCode);
        if (!course) return;

        // Handle specialized elective trail selection
        if (course.category.includes('Trail')) {
            const selectedElectiveTrails = this.getSelectedElectiveTrails();

            // First elective trail selection (for first 2 courses)
            if (selectedElectiveTrails.firstTrailCourses < 2 && !this.electiveTrailSelections.firstTrail) {
                this.electiveTrailSelections.firstTrail = course.category;
            }
            // Third elective trail selection (can be any trail)
            else if (selectedElectiveTrails.firstTrailCourses >= 2 &&
                     selectedElectiveTrails.thirdTrailCourses === 0 &&
                     !this.electiveTrailSelections.thirdTrail) {
                this.electiveTrailSelections.thirdTrail = course.category;
            }
        }

        // Add corequisites automatically
        if (course.corequisites && course.corequisites.length > 0) {
            course.corequisites.forEach(coreq => {
                if (!this.selectedCourses.has(coreq)) {
                    this.selectedCourses.add(coreq);
                }
            });
        }

        this.selectedCourses.add(courseCode);
        this.updateStats();
        this.renderCourses();

        // Clear search bar after selecting a course
        this.clearSearch();
    }

    removeCourse(courseCode) {
        const course = this.courses.find(c => c.code === courseCode);
        if (!course) return;

        // Handle specialized elective trail deselection
        if (course.category.includes('Trail')) {
            const selectedElectiveTrails = this.getSelectedElectiveTrails();

            // If removing from first trail and it was the last course from that trail
            if (this.electiveTrailSelections.firstTrail === course.category) {
                const remainingFromFirstTrail = selectedElectiveTrails.trailCounts[course.category] - 1;
                if (remainingFromFirstTrail <= 0) {
                    this.electiveTrailSelections.firstTrail = null;
                }
            }

            // If removing from third trail and it was the only course from that trail
            if (this.electiveTrailSelections.thirdTrail === course.category) {
                const remainingFromThirdTrail = selectedElectiveTrails.trailCounts[course.category] - 1;
                if (remainingFromThirdTrail <= 0) {
                    this.electiveTrailSelections.thirdTrail = null;
                }
            }
        }

        // Remove corequisites if they were added automatically
        if (course.corequisites) {
            course.corequisites.forEach(coreq => {
                if (this.selectedCourses.has(coreq)) {
                    const manuallySelected = Array.from(this.selectedCourses).some(code => {
                        if (code === courseCode) return false;
                        const c = this.courses.find(course => course.code === code);
                        return c && c.corequisites && c.corequisites.includes(coreq);
                    });
                    if (!manuallySelected) {
                        this.selectedCourses.delete(coreq);
                    }
                }
            });
        }

        this.selectedCourses.delete(courseCode);
        this.updateStats();
        this.renderCourses();

        // Clear search bar after removing a course
        this.clearSearch();
    }

    // Clear the search input field
    clearSearch() {
        this.searchInput.value = '';
        this.searchInput.dispatchEvent(new Event('input'));
    }

    getSelectedElectiveTrails() {
        const trailCourses = Array.from(this.selectedCourses)
            .map(code => this.courses.find(c => c.code === code))
            .filter(course => course && course.category.includes('Trail'));

        const trailCounts = {};
        trailCourses.forEach(course => {
            trailCounts[course.category] = (trailCounts[course.category] || 0) + 1;
        });

        const firstTrailCourses = this.electiveTrailSelections.firstTrail ?
            (trailCounts[this.electiveTrailSelections.firstTrail] || 0) : 0;

        const thirdTrailCourses = this.electiveTrailSelections.thirdTrail ?
            (trailCounts[this.electiveTrailSelections.thirdTrail] || 0) : 0;

        return {
            trailCourses,
            trailCounts,
            firstTrailCourses,
            thirdTrailCourses
        };
    }

    filterCourses(courses, searchTerm, categoryFilter, typeFilter) {
        const selectedElectiveTrails = this.getSelectedElectiveTrails();

        return courses.filter(course => {
            // Search term filter
            if (searchTerm) {
                const term = searchTerm.toLowerCase();
                if (!course.code.toLowerCase().includes(term) &&
                    !course.name.toLowerCase().includes(term) &&
                    !course.category.toLowerCase().includes(term)) {
                    return false;
                }
            }

            // Category filter
            if (categoryFilter && course.category !== categoryFilter) {
                return false;
            }

            // Type filter
            if (typeFilter && course.type !== typeFilter) {
                return false;
            }

            // Specialized elective trail filtering
            if (course.category.includes('Trail')) {
                // If first trail is selected, only show courses from that trail for first 2 electives
                if (this.electiveTrailSelections.firstTrail &&
                    selectedElectiveTrails.firstTrailCourses < 2 &&
                    course.category !== this.electiveTrailSelections.firstTrail) {
                    return false;
                }

                // If first 2 electives are from one trail, third can be from any trail
                // But we still want to show all trail courses for selection
            }

            return true;
        });
    }

    getCategoryClass(category) {
        const categoryMap = {
            'CSE Core': 'category-core',
            'SEPS Core': 'category-seps',
            'University Core': 'category-university',
            'CSE Major Capstone Design': 'category-capstone',
            'CSE Specialized Elective': 'category-elective',
            'Open Elective': 'category-open-elective',
            'Internship / Co-op': 'category-internship',
            'Algorithms and Computation Trail': 'category-elective',
            'Software Engineering Trail': 'category-software',
            'Networks Trail': 'category-network',
            'Computer Architecture and VLSI Trail': 'category-architecture',
            'Artificial Intelligence Trail': 'category-ai',
            'Bioinformatics Trail': 'category-bio'
        };

        return categoryMap[category] || 'category-core';
    }

    getTypeClass(type) {
        return type === 'lab' ? 'type-lab' : 'type-theory';
    }

    createElectiveTrailInfo() {
        const selectedElectiveTrails = this.getSelectedElectiveTrails();
        const totalTrailCourses = selectedElectiveTrails.trailCourses.length;

        if (totalTrailCourses === 0) return '';

        let infoHTML = `
            <div class="elective-trail-info">
                <h3>Specialized Elective Progress</h3>
                <div class="trail-progress">
        `;

        // First trail requirement (2 courses/6 credits)
        if (this.electiveTrailSelections.firstTrail) {
            const firstTrailCount = selectedElectiveTrails.firstTrailCourses;
            infoHTML += `
                <div class="trail-requirement">
                    <p><strong>First Trail (${this.electiveTrailSelections.firstTrail}):</strong>
                    ${firstTrailCount}/2 courses (minimum 6 credits)</p>
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${Math.min(firstTrailCount * 50, 100)}%"></div>
                    </div>
                </div>
            `;
        }

        // Third elective requirement (1 course/3 credits)
        if (totalTrailCourses >= 2) {
            const thirdTrailCount = selectedElectiveTrails.thirdTrailCourses;
            const thirdTrailName = this.electiveTrailSelections.thirdTrail || 'Any Trail';
            infoHTML += `
                <div class="trail-requirement">
                    <p><strong>Third Elective (${thirdTrailName}):</strong>
                    ${thirdTrailCount}/1 course (3 credits)</p>
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${thirdTrailCount * 100}%"></div>
                    </div>
                </div>
            `;
        }

        infoHTML += `
                </div>
                <p class="trail-requirement-text">
                    <strong>Requirement:</strong> Select minimum 2 courses (6 credits) from one trail,
                    and 1 additional course (3 credits) from any trail.
                </p>
            </div>
        `;

        return infoHTML;
    }

    createCourseCard(course, isSelected = false) {
        const card = document.createElement('div');
        card.className = `course-card ${isSelected ? 'selected' : ''}`;

        // Check if course is available for selection
        const isAvailable = !isSelected && this.isCourseAvailable(course);
        const wouldViolate = this.wouldViolateAlternatives(course.code);

        if (!isAvailable && !isSelected) {
            card.classList.add('disabled');
        }

        // Create prerequisites display
        let prereqDisplay = '';
        if (course.prerequisites && course.prerequisites.length > 0) {
            prereqDisplay = `
                <div class="prerequisites">
                    <strong>Prerequisites:</strong>
                    <div class="prerequisites-list">
                        ${course.prerequisites.map(prereq =>
                            `<span class="prerequisite-tag">${prereq}</span>`
                        ).join('')}
                    </div>
                </div>
            `;
        }

        // Create corequisites display
        let coreqDisplay = '';
        if (course.corequisites && course.corequisites.length > 0) {
            coreqDisplay = `
                <div class="prerequisites">
                    <strong>Corequisites:</strong>
                    <div class="prerequisites-list">
                        ${course.corequisites.map(coreq =>
                            `<span class="prerequisite-tag">${coreq}</span>`
                        ).join('')}
                    </div>
                </div>
            `;
        }

        // Special handling for elective placeholders
        let specialInfo = '';
        if (course.code.startsWith('ELECTIVE')) {
            specialInfo = `
                <div class="elective-placeholder-info">
                    <p><strong>Specialized Elective Placeholder</strong></p>
                    <p>Select specialized elective courses from the trails below.</p>
                </div>
            `;
        }

        // Special handling for trail courses
        if (course.category.includes('Trail')) {
            specialInfo += `
                <div class="trail-course-info">
                    <p><strong>${course.category}</strong></p>
                </div>
            `;
        }

        // Show alternative course information
        const alternativeGroup = this.getAlternativeGroup(course.code);
        if (alternativeGroup.length > 1) {
            const selectedAlternatives = alternativeGroup.filter(code =>
                this.selectedCourses.has(code) && code !== course.code
            );

            if (selectedAlternatives.length > 0) {
                specialInfo += `
                    <div class="alternative-info warning">
                        <p><strong>⚠️ Alternative Course Conflict:</strong> ${selectedAlternatives.join(', ')} already selected</p>
                    </div>
                `;
            } else if (!isSelected) {
                const alternatives = alternativeGroup.filter(code => code !== course.code);
                specialInfo += `
                    <div class="alternative-info">
                        <p><strong>ℹ️ Alternative Courses:</strong> ${alternatives.join(', ')}</p>
                        <p><small>Note: You can only select one of these alternatives</small></p>
                    </div>
                `;
            }
        }

        card.innerHTML = `
            <div class="course-header">
                <div class="course-code">${course.code}</div>
                <div class="course-credits">${course.credits} cr</div>
            </div>
            <div class="course-name">${course.name}</div>
            <div class="course-details">
                <span class="course-type ${this.getTypeClass(course.type)}">${course.type}</span>
                <span class="course-category ${this.getCategoryClass(course.category)}">${course.category}</span>
            </div>
            ${specialInfo}
            ${prereqDisplay}
            ${coreqDisplay}
            <button class="action-button ${isSelected ? 'remove-button' : 'add-button'}">
                ${isSelected ? '−' : '+'}
            </button>
        `;

        const actionButton = card.querySelector('.action-button');
        actionButton.addEventListener('click', (e) => {
            e.stopPropagation();
            if (isSelected) {
                this.removeCourse(course.code);
            } else if (isAvailable) {
                this.addCourse(course.code);
            }
        });

        if (!isSelected && isAvailable) {
            card.addEventListener('click', () => {
                this.addCourse(course.code);
            });
        }

        // Add tooltip for disabled courses due to alternatives
        if (wouldViolate && !isSelected) {
            card.title = "Cannot select this course because an alternative course is already selected";
        }

        return card;
    }

    renderCourses() {
        const searchTerm = this.searchInput.value.trim();

        // Render selected courses
        const selectedCoursesArray = Array.from(this.selectedCourses)
            .map(code => this.courses.find(c => c.code === code))
            .filter(Boolean);

        const filteredSelected = this.filterCourses(selectedCoursesArray, searchTerm, '', '');
        this.selectedCoursesList.innerHTML = '';
        filteredSelected.forEach(course => {
            this.selectedCoursesList.appendChild(this.createCourseCard(course, true));
        });

        // Render available courses
        const availableCourses = this.courses.filter(course =>
            !this.selectedCourses.has(course.code)
        );

        const filteredAvailable = this.filterCourses(availableCourses, searchTerm, this.categoryFilter, this.typeFilter);
        this.availableCoursesList.innerHTML = '';

        // Add elective trail info if any trail courses are selected
        const selectedElectiveTrails = this.getSelectedElectiveTrails();
        if (selectedElectiveTrails.trailCourses.length > 0) {
            const trailInfo = document.createElement('div');
            trailInfo.innerHTML = this.createElectiveTrailInfo();
            this.availableCoursesList.appendChild(trailInfo);
        }

        filteredAvailable.forEach(course => {
            this.availableCoursesList.appendChild(this.createCourseCard(course, false));
        });
    }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
    const coursesData = await loadCoursesData();
    if (coursesData && coursesData.length > 0) {
        new CoursePlanner(coursesData);
    } else {
        console.error('Failed to load course data');
        // Show error message to user
        document.body.innerHTML = `
            <div style="text-align: center; padding: 50px; font-family: Arial, sans-serif;">
                <h1>Error Loading Course Data</h1>
                <p>Unable to load course information. Please check your internet connection and try again.</p>
            </div>
        `;
    }
});
