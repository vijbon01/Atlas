define([
	'knockout',
	'text!./person.html',
	'd3',
  'const',
  'pages/data-sources/classes/Report',
  'providers/Component',
  'components/heading',
  'components/charts/histogram',
  'components/charts/donut',
], function (
	ko,
	view,
	d3,
  helpers,
  Report,
  Component
) {
	class Person extends Report {
    static get name() {
      return 'person';
    }

    static get view() {
      return view;
    }

    constructor(params) {
      super(params);
      
      this.yearHistogramData = ko.observable();
      this.genderData = ko.observable();
      this.raceData = ko.observable();
      this.ethnicityData = ko.observable();

      this.chartFormats = {
        yearHistogram: {
          xFormat: d3.format('d'),
          yFormat: d3.format(',.1s'),
          xLabel: 'Year',
          yLabel: 'People',
        },        
      };
      
      this.getData()
        .then(({ data }) => {
          if (data.yearOfBirth.length > 0 && data.yearOfBirthStats.length > 0) {
            var histData = {};
            histData.intervalSize = 1;
            histData.min = data.yearOfBirthStats[0].minValue;
            histData.max = data.yearOfBirthStats[0].maxValue;
            histData.intervals = 100;
            histData.data = (helpers.normalizeArray(data.yearOfBirth));
            this.yearHistogramData(helpers.mapHistogram(histData));
          }

          this.genderData(helpers.mapConceptData(data.gender));
          this.raceData(helpers.mapConceptData(data.race));
          this.ethnicityData(helpers.mapConceptData(data.ethnicity));

        });

    }
  }

  return Component.build(Person);
});