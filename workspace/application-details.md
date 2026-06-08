
# Project Management Application
This application is a heads-up project management application.  Task items resemble a post-it-note style with the ability to drill into topics and add notes and details.  Task items are recursive, and allow the ability to drill into each item, and add sub-items indefinitely.  Each item is a completable task, that can house sub-tasks and notes.  Notes are a single level "post-it-note" type, that has a title and some description of arbitrary length.  Sub-tasks are just tasks with the same format as the parent task.  See more details below.

The application uses an HTML Canvas for layout, and allows complete ability to move items around within the layout to any position.  The project itself is the owner of sub-tasks, and it's layout mechanism is the same.  The layout system is pretty simple in concept.  Tasks are a box, displaying a few details about it.  It can be dragged around the layout to any position.  Double clicking the task will open the task's layout, and all of it's sub-tasks.  Clicking on a task will allow the ability to view/edit the properties of the task in the details pane on the right side of the window.  Notes are also viewed and edited in the layout.  They look similar to tasks, but have a different color, and cannot own other notes/tasks.  Otherwise, they can be moved around and positioned just like a task can.

## Main Data Types
There will be a number of data types defined here that achieve the main goal in concept.  It's expected that a number of other data types will be needed to support the main data types as well as the overall application.  Those may not be listed in this documentation.

The properties of the data types below are only partial lists.  More will obviously be required to make them function within the application.

### Project
The project is a self-contained data-set.  It will have a number of properties of it's own, and own a number of tasks and notes of its own.

#### Project Properties:
  - Name
  - Description

### Task
A task is a recursive container of tasks/notes that contain information about a task that should be completed.  It has a parent project, and optionally, a parent task.  If the parent task is not set, then it belongs in the owning project directly.  Otherwise, it belongs in its parent task's layout.

The Urgency of a task controls the color of it's background.  (CLAUDE: Determine the background colors.)

#### Task Layout Representation
The task is represented by a rectangular, editable object.  The color of its full background is based on the Urgency property of the task.  It has a border of the same hue as the background, but slightly darker.

The task has a bold and prominent title, a horizontal border, and the description in the lower body of the rectangle.  The description content will be truncated if it does not fit within the lower body of the tasks rectangular content area.

The task is sizeable, and positionable, representing the same sizing features of a window within MS Windows.

#### Task Properties (Partial):
  - Title
  - Description
  - Urgency: (Enum Value)
    - Long Term Goal
    - Low
    - Normal
    - Important
    - Urgent
    - Immediate
  - Layout: The position/size within the layout.

### Note
A note is much like a task, but only has a couple properties to show and edit.

#### Note Layout Representation
The representation of a Note is the same as a Task with the following exceptions.

The header of the task is always an off-yellow.  The body of the note is user-defined.

The note is positionable and sizable, just like a Task.

#### Note Properties:
  - Title
  - Details
  - Background Color
  - Layout: The position/size within the layout.

### Layout
The Layout type represents the position and size of the visual elements in the layout canvas.

#### Layout Properties:
  - X
  - Y
  - Width
  - Height

## Data Objects & Database Strategy
Use separate MongoDB containers for Projects, Tasks, and Notes.  They should all be related through key properties, defined by the _id values of the parents.

## Routes and Navigation
Use routing to navigate to various pages/components within the application.  This includes task layouts and project layouts.  Use appropriate hierarchies in the routes for navigation, so it's easy to navigate backwards to parent pages in the route by simply removing right-most portions of the child routes.

## Application Layout
The top of the site will have a title and breadcrumb bar shared throughout the application.

The application will have a main page listing the projects.  Projects can be created on this page and also navigated to.

The project layout is the main page for user interactivity.  It consists of a project name and "edit" button on the top of the page, under the title.  There is a properties pain on the right of the screen to edit (with a accept/cancel button) on the right of the page.  It always shows the currently selected item (project, task, or note).  When nothing is selected, then the project information shows on the edit pane.  The remainder of the page is an HTML Canvas that always sizes to the remainder of the page area.  This is the layout of the tasks/notes in the page.

When navigating into a task, it uses the same setup as the project page.  The exceptions are that the task itself is selected when nothing else is, and there is a button allowing navigation back to the parent task or project.

The layout canvas should allow the user to zoom and pan.  Panning is done by holding the middle mouse button and dragging, and zooming is with the middle mouse wheel.  Zooming should always center around the mouse's current position.

## Architectural Considerations
This application WILL be expanded and iterated on in the future.  New ways of grouping and organizing tasks and notes is fully expected.

### RXJS
Use RXJS Observables for signalling throughout the UI project.  This should be a main architectural piece of how things change and flow through the UI.  Observables should NOT be used in data types stored in the database though.

Before displaying components, ensure that the data backing the component(s) is fully loaded.  Use the observables for indicators and cues.

Ensure that the CSS and styling is consistently applied throughout the application.  This sometimes gets missed when creating components like dialogs and similar elements.

Any PrimeNG component that has an "appendTo" property (i.e. dialogs and drop-downs) must be set to "body".

All items must be able to be editable and deletable.  Deleting an item will always delete its children.  Always use confirmation dialogs to confirm deletions before executing the actual deletion.  Deletions are hard-deletes, and permanent.

### Structural
Use services to perform common activities and encapsulate multi-step processes.  Avoid repeating code for similar activities within the application.  Use abstraction over simple design.  Consider the single responsibility principle as an important aspect to all services, and delegate activities to purpose-built services and managers.

There should be a hierarchial system and simple design concepts/rules driving the design of the application.  Those design concepts and rules must be stated at a top-level of the design documentation resulting from this file.  Don't be afraid to make those concepts and rules non-standard or arbitrary if they fit the methodology of the application.  These principles should drive the ability to expand and design the architecture of the application over its lifetime.

The first design principle for this application is it's purpose.  And here it is (if a bit unrefined): "This application provides visually interactive task management focusing on a user's spacial awareness and spacial memory to help organize the application.  In addition, it strives to allow strong strategies for grouping and categorizing the task-based information."