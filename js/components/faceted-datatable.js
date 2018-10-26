define(['knockout', 'text!./faceted-datatable.html', 'crossfilter', 'colvis', 'services/http', 'appConfig'], function (ko, view, crossfilter, colvis, httpService, config) {

	function facetedDatatable(params) {
		const self = this;

		self.headersTemplateId = params.headersTemplateId;
		self.componentLoading = ko.observable(true);
		self.facets = ko.observableArray();

		self.nullFacetLabel = params.nullFacetLabel || 'NULL';
		self.options = params.options;
		self.columns = params.columns;
		self.rowCallback = params.rowCallback || function () {
		};
		self.rowClick = params.rowClick;
		self.drawCallback = params.drawCallback;

		// Set some defaults for the data table
		self.autoWidth = params.autoWidth || true;
		self.buttons = params.buttons || [
			'colvis', 'copyHtml5', 'excelHtml5', 'csvHtml5', 'pdfHtml5'
		];
		self.colVis = params.colVis || {
			buttonText: 'Change Columns',
			align: 'right',
			overlayFade: 0,
			showAll: 'Show All Columns',
			restore: 'Reset Columns'
		};
		self.deferRender = params.deferRender || true;
		self.dom = params.dom || '<<"row vertical-align"<"col-xs-6"<"dt-btn"B>l><"col-xs-6 search"f>><"row vertical-align"<"col-xs-3"i><"col-xs-9"p>><t><"row vertical-align"<"col-xs-3"i><"col-xs-9"p>>>';
		self.language = params.language || {
			search: 'Filter: '
		};
		self.pageLength = params.pageLength || 15;
		self.lengthMenu = params.lengthMenu || [
			[15, 30, 45, 100, -1],
			[15, 30, 45, 100, 'All']
		];
		self.order = params.order || [
			[1, 'desc']
		];
		self.orderColumn = 1;
		if (params.orderColumn) {
			self.order = [
				[params.orderColumn, 'desc']
			]
		}
		self.orderClasses = params.orderClasses || false;
		self.ordering = params.ordering || true;
		self.scrollOptions = params.scrollOptions || null;

		function buildFilter(search) {
			let filter = self.facets().map((f) => {
				return {
					name: f.caption,
					selectedItems: Object.keys(f.selectedItems).map(item => {
						return {
							text: f.selectedItems[item].text,
							key: f.selectedItems[item].key,
						}
					})
				}
			});
			if (search.value !== "") {
				self.columns.forEach(c => {
					if (c.searchable) {
						filter.push({
							name: c.data,
							selectedItems:[{text: search.value, key: ""}]
						})
					}
				})
			}
			return filter;
		}

		if (params.ajax) {
			self.ajax = (d, callback, settings) => {
				self.componentLoading(true);
				params.ajax({
						page: d.start / d.length,
						size: d.length,
						filter: JSON.stringify(buildFilter(d.search)),
						sort: self.order.map(s => {
							return [params.columns[s[0]].data, s[1]]
						})
					}
				)
					.then(({data}) => {
						callback({
							draw: d.draw,
							recordsTotal: data.totalElements,
							recordsFiltered: data.totalElements,
							data: data.content
						});
						self.componentLoading(false);
					})
			};
			self.createFilters = () => {
				self.facets.removeAll();
				if (self.options && self.options.Facets) {
					self.options.Facets.forEach(facetConfig => {
						httpService.doGet(config.webAPIRoot + "facets?facet=" + facetConfig.caption + '&entityName=' + self.options.entityName)
							.then(({data}) => {
								// var isArray = facetConfig.isArray || false;
								let facet = {
									'caption': facetConfig.caption,
									'binding': facetConfig.binding,
									'dimension': data,
									'facetItems': [],
									'selectedItems': {},
								};
								// Add a selected observable to each dimension
								data.forEach((d) =>
									facet.facetItems.push({
										key: d.key,
										text: d.text,
										count: d.count,
										dimension: data,
										selected: ko.observable(false),
										facet: facet
									})
								);
								self.facets.push(facet);
							})
							.catch((e) => {
								console.log(e);
							})
					});
					// Iterate over the facets and set any defaults
					/*
									$.each(self.options.Facets, function (i, facetConfig) {
										if (facetConfig.defaultFacets && facetConfig.defaultFacets.length > 0) {
											$.each(facetConfig.defaultFacets, function (d, defaultFacet) {
												var facetItem = $.grep(self.facets()[i].facetItems, function (f) {
													return f.key == defaultFacet;
												});
												if (facetItem.length > 0) {
													self.updateFilters(facetItem[0], null);
												}
											})
										}
									});
					*/
				}
			};
			self.updateFilters = function (data, event) {
				let facet = data.facet;
				data.selected(!data.selected());
				if (data.selected()) {
					if (!facet.selectedItems.hasOwnProperty(data.key)) {
						facet.selectedItems[data.text] = data;
					}
				} else {
					delete facet.selectedItems[data.text];
				}
				self.facets.valueHasMutated();
			};
			self.createFilters();
		} else {
			self.ajax = null;
			self.reference = params.reference;
			self.data = params.xfObservable || ko.observable();
			self.tableData = ko.pureComputed(function () {
				if (self.data() && self.data().size() && self.data().size() > 0) {
					return self.data().allFiltered();
				} else {
					return [];
				}
			});
			self.updateFilters = function (data, event) {
				var facet = data.facet;
				data.selected(!data.selected());
				if (data.selected()) {
					if (!facet.selectedItems.hasOwnProperty(data.key)) {
						facet.selectedItems[data.key] = data;
					}
				} else {
					delete facet.selectedItems[data.key];
				}
				var filter = [];
				$.each(facet.selectedItems, function (i, n) {
					filter.push(n.key);
				});
				if (filter.length <= 0) {
					facet.dimension.filterAll();
				} else {
					facet.dimension.filter(function (d) {
						return filter.indexOf(d) > -1;
					});
				}
				self.data.valueHasMutated();
			}

			// additional helper function to help with crossfilter-ing dimensions that contain nulls
			self.facetDimensionHelper = function facetDimensionHelper(val) {
				var ret = val === null ? self.nullFacetLabel : val;
				return ret;
			}

			self.reference.subscribe(function (newValue) {
				if (self.reference() != null) {
					self.componentLoading(true);
					self.data(new crossfilter(self.reference()));
					self.facets.removeAll();
					if (self.options && self.options.Facets) {
						// Iterate over the facets and set the dimensions
						self.options.Facets.forEach(facetConfig => {
							var isArray = facetConfig.isArray || false;
							var dimension = self.data().dimension(d => self.facetDimensionHelper(facetConfig.binding(d)), isArray);
							var facet = {
								'caption': facetConfig.caption,
								'binding': facetConfig.binding,
								'dimension': dimension,
								'facetItems': [],
								'selectedItems': new Object(),
							};
							// Add a selected observable to each dimension
							dimension.group().top(Number.POSITIVE_INFINITY).forEach(facetItem => {
								facetItem.text = facetItem.key;
								facetItem.count = facetItem.value;
								facetItem.dimension = dimension;
								facetItem.selected = ko.observable(false);
								facetItem.facet = facet;
								facet.facetItems.push(facetItem);
							});
							self.facets.push(facet);
						});
						// Iterate over the facets and set any defaults
						$.each(self.options.Facets, function (i, facetConfig) {
							if (facetConfig.defaultFacets && facetConfig.defaultFacets.length > 0) {
								$.each(facetConfig.defaultFacets, function (d, defaultFacet) {
									var facetItem = $.grep(self.facets()[i].facetItems, function (f) {
										return f.key == defaultFacet;
									});
									if (facetItem.length > 0) {
										self.updateFilters(facetItem[0], null);
									}
								})
							}
						});
					}
					self.componentLoading(false);
				}
			});

			self.reference.valueHasMutated(); // init component
		}
	}

	let component = {
		viewModel: facetedDatatable,
		template: view
	};

	ko.components.register('faceted-datatable', component);
	return component;
});
