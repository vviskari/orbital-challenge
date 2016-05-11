var EARTH_RADIUS = 6371;

function Point(name, type, lat, lon, r) {
    // convert to radians
    this.x = r * Math.sin((lat + 90) * Math.PI / 180) * Math.cos((lon + 180) * Math.PI / 180);
    this.y = r * Math.sin((lat + 90) * Math.PI / 180) * Math.sin((lon + 180) * Math.PI / 180);
    this.z = r * Math.cos((lat + 90) * Math.PI / 180);
    this.name = name;
    this.type = type;
    this.distance = Number.MAX_SAFE_INTEGER;
    this.processed = false;
    this.visiblePoints = [];
}

var SatelliteRouter = function() {
    var router = this;
    var points = [];

    this.parseData = function(data) {
        data.split('\n').forEach(function(line) {
            if (line.startsWith('#SEED: ')) {
                router.seed = line.substring(6);
            }
            if (line.startsWith('SAT')) {
                var coords = line.split(',');
                points.push(new Point(coords[0],
                    'satellite',
                    parseFloat(coords[1]),
                    parseFloat(coords[2]),
                    EARTH_RADIUS + parseFloat(coords[3])
                ));
            }
            if (line.startsWith('ROUTE')) {
                // elevate the start and end points by 10 meters
                // so it does not touch the sphere
                var coords = line.split(',')
                var start = new Point('start',
                    'start',
                    parseFloat(coords[1]),
                    parseFloat(coords[2]),
                    EARTH_RADIUS + 0.01);
                //start distance set to 0 for dijkstra starting point
                start.distance = 0;

                var end = new Point('end',
                    'end',
                    parseFloat(coords[3]),
                    parseFloat(coords[4]),
                    EARTH_RADIUS + 0.01);
                points.push(start);
                points.push(end);
            }
        });
    }

    this.buildVisibilityGraph = function() {
        var isVisible = function(p1, p2) {
            // http://paulbourke.net/geometry/circlesphere/

            // check if closest point of line to circle center is between p1 and p2
            var u = (-p1.x * (p2.x - p1.x) - p1.y * (p2.y - p1.y) - p1.z * (p2.z - p1.z)) /
                (Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2) + Math.pow(p2.z - p1.z, 2));

            if (u < 0 || u > 1) {
                // line segment does not intersect sphere
                return true;
            }
            var a = Math.pow(p2.x - p1.x, 2) +
                Math.pow(p2.y - p1.y, 2) +
                Math.pow(p2.z - p1.z, 2);
            var b = 2 * (
                (p2.x - p1.x) * p1.x +
                (p2.y - p1.y) * p1.y +
                (p2.z - p1.z) * p1.z
            );
            var c = Math.pow(p1.x, 2) +
                Math.pow(p1.y, 2) +
                Math.pow(p1.z, 2) -
                Math.pow(EARTH_RADIUS, 2);

            var discriminant = Math.pow(b, 2) - (4 * a * c);
            if (discriminant < 0.0) {
                // discriminant is negative, there are no solutions to the intersection
                // so the line segment does not touch the sphere
                return true;
            }
            return false;
        }

        points.forEach(function(point1) {
            points.forEach(function(point2) {
                if (point1 !== point2 && isVisible(point1, point2)) {
                    point1.visiblePoints.push(point2);
                }
            });
        });
    }
    
    this.calculateShortestRoute = function() {
        // Dijkstra algorithm
        var route = [];
        var start = points.find(function(point) {
            return point.type === 'start';
        })
        var end = points.find(function(point) {
            return point.type === 'end';
        })
        var currentPoint = start;

        while (currentPoint && currentPoint.distance < Number.MAX_SAFE_INTEGER) {
            // process node
            currentPoint.visiblePoints.forEach(function(visiblePoint) {
                // distance between currentPoint and visiblePoint
                var d = Math.sqrt(
                    Math.pow(currentPoint.x - visiblePoint.x, 2) +
                    Math.pow(currentPoint.y - visiblePoint.y, 2) +
                    Math.pow(currentPoint.z - visiblePoint.z, 2)
                );
                if ((d + currentPoint.distance) < visiblePoint.distance) {
                    visiblePoint.distance = (d + currentPoint.distance);
                }
            });
            currentPoint.processed = true;

            // sort nodes based on shortest distance and get next unprocessed
            currentPoint = points.sort(function(p0, p1) {
                return p0.distance - p1.distance;
            }).find(function(point) {
                return !point.processed;
            })
        }

        if (end.distance === Number.MAX_SAFE_INTEGER) {
            // dijksta didn't finish, no route
            return route;
        }

        // backtrack from end the shortest path
        currentPoint = end;
        while (currentPoint !== start) {
            currentPoint = currentPoint.visiblePoints.sort(function(point0, point1) {
                return point0.distance - point1.distance;
            }).shift();
            if (currentPoint !== start) {
                route.push(currentPoint);
            }
        }
        return route.reverse();
    }

    this.route = function() {
        this.buildVisibilityGraph();
        var route = this.calculateShortestRoute();
        var results = "NONE";
        if (route.length > 0) {
            results = route.map(function(point) {
                return point.name;
            }).join(',')
        }
        return results;
    }
}

function renderSeed(s) {
    document.getElementById('seed').innerHTML = "<h3>SEED: " + s + "</h3>";
}

function renderResults(res) {
    document.getElementById('results').innerHTML = "<h3>ROUTE: " + res + "</h3>";
}

function runRouter() {
    var s = new Date();
    var router = new SatelliteRouter();
    router.parseData(document.getElementById('data-field').value);
    renderSeed(router.seed);
    renderResults(router.route());
    console.log("Router finished in", (new Date().getTime() - s.getTime()), "ms");
}
document.getElementById('route').addEventListener('click', runRouter);
