# Waypoint Route Planner

## Introduction

Welcome to the **Waypoint Route Planner**! This is an interactive web-based tool designed to upload an image (think of it as a map or a layout) and plot waypoints on it, calculate the optimal route between these points, and visualize it. You can set a start and an endpoint, as well as add multiple waypoints anywhere on your uploaded image.

The route calculation utilizes the **Held-Karp dynamic programming algorithm**, which finds the shortest Hamiltonian path through all waypoints between the specified start and end locations. The tool is intended to visualize routes and provides a hands-on demonstration of complex combinatorial optimization.

This is a perfect tool for educational purposes, tinkering, and gaining a deeper understanding of graph theory and dynamic programming while also enjoying visualizations.

## Features

- **Image Upload:** Upload your favorite map or diagram to use as the base layer.
- **Add Points:** Mark locations as waypoints, a start point, and an endpoint on the uploaded image.
- **Automatic Shortest Path Calculation:** The tool calculates the optimal path between the start and end points, passing through all waypoints in an efficient order.
- **Interactive Visualization:** See the resulting route drawn directly on the image.
- **Save and Load Routes:** Save your waypoints and routes to the browser's local storage and load them later.

## Mathematics Behind the Optimization

The shortest route problem presented here is a variation of the **Travelling Salesman Problem (TSP)**—a classic optimization problem. In our case, however, we have a **fixed start and end point**, making this problem even more specific as a **Hamiltonian Path** problem.

### The Held-Karp Algorithm

The **Held-Karp algorithm** is a dynamic programming solution used for finding the shortest Hamiltonian path between the nodes of a complete graph. It is a specialized version of a broader category of TSP algorithms. Let's dive into the inner workings of the algorithm used in our tool:

1. **Problem Representation**: The input consists of a list of points (start point, waypoints, end point) represented as nodes of a graph, with edges weighted by the Euclidean distances between points.

2. **Distance Matrix Calculation**: We calculate the **distance matrix**, which represents the pairwise distances between all points using the Euclidean formula:
   
   
   \[
   d_{i,j} = \sqrt{(x_i - x_j)^2 + (y_i - y_j)^2}
   \]
   
   This matrix is symmetric, as the distance from point A to point B is the same as from B to A.

3. **Dynamic Programming State Representation**:
   - Let **S** be a set of nodes that have been visited.
   - Let **dp[S][i]** represent the minimum cost to reach node **i** from the start node, visiting all nodes in set **S**.
   
4. **Base State**:
   - Start by initializing **dp[1 << start][start] = 0**. This indicates that the cost to be at the start node having visited only itself is zero.

5. **Recursive Transition**:
   - For each subset of nodes that includes the start point, and for each node **last** within the subset, we iterate over each possible **next** node that is not in the subset.
   - The transition formula is as follows:
     
     \[
     dp[nextSubset][next] = \min(dp[nextSubset][next], dp[subset][last] + distanceMatrix[last][next])
     \]
     
   This formula updates the cost of reaching **next** by taking the best cost of reaching **last** and adding the edge weight between **last** and **next**.

6. **Path Reconstruction**:
   - After computing the minimum cost to reach the endpoint, we reconstruct the optimal path by backtracking through the **parent** matrix, which records which node led to the optimal state.

### Complexity

The **Held-Karp algorithm** runs in **O(n^2 * 2^n)** time complexity, where **n** is the number of nodes. This is computationally feasible for small to medium-sized problems (like our waypoints), but not for very large numbers of points due to the exponential growth.

In practice, this means that the route planner is suitable for small maps or scenarios with a limited number of waypoints—ideal for our purposes of route visualization and understanding combinatorial optimization!

## How to Use the Tool

1. **Upload an Image**: Use the "Upload Image" button to upload your map or background image.
2. **Add Start, End, and Waypoints**:
   - Click "Add Start Point" and click on the map to designate the start.
   - Click "Add End Point" and click to designate the endpoint.
   - Click "Add Waypoint" to add intermediary waypoints.
3. **Calculate Route**: Click "Calculate Route" to visualize the shortest route that passes through all waypoints in an optimal order.
4. **Save and Load Routes**: Save your current waypoints and routes for later use or experimentation.

## Limitations
- The Held-Karp implementation, due to its exponential complexity, is not practical for more than approximately 15-20 waypoints.
- No accounting for real-world obstacles, such as roads or barriers—the distances are calculated "as the crow flies."