import React, { PropTypes, Component } from 'react';
import d3 from 'd3';
import Chart from './Chart';
import Axis from './Axis';
import Path from './Path';
import Tooltip from './Tooltip';
import * as helpers from './helpers.js';

class DataSet extends Component {

  static propTypes = {
    data: PropTypes.array.isRequired,
    area: PropTypes.func.isRequired,
    label: PropTypes.func,
    line: PropTypes.func.isRequired,
    colorScale: PropTypes.func.isRequired,
    stroke: PropTypes.func.isRequired,
    values: PropTypes.func
  };

  render() {
    const {
      data,
      area,
      line,
      colorScale,
      stroke,
      values,
      label,
      onMouseMove,
      onMouseLeave
    } = this.props;

    const areas = data.map((stack, index) => {
      return (
          <Path
          key={`${label(stack)}.${index}`}
          className='area'
          stroke='none'
          fill={colorScale(label(stack))}
          d={area(values(stack))}
          onMouseMove={onMouseMove}
          onMouseLeave={onMouseLeave}
          data={data}
          />
          );
    });

    data.map(stack => {
      return (
          <Path
          className='line'
          d={line(values(stack))}
          stroke={stroke(label(stack))}
          data={data}
          />
          );
    });

    return (<g>{areas}</g>);
  }
}

class AreaChart extends Component {

  static propTypes = {
    colorScale: PropTypes.func,
    data: PropTypes.oneOfType([
      PropTypes.object,
      PropTypes.array
    ]).isRequired,
    height: PropTypes.number.isRequired,
    interpolate: PropTypes.string,
    label: PropTypes.func,
    legend: PropTypes.object,
    margin: PropTypes.shape({
      top: PropTypes.number,
      bottom: PropTypes.number,
      left: PropTypes.number,
      right: PropTypes.number
    }),
    stroke: PropTypes.func,
    tooltipHtml: PropTypes.func,
    tooltipMode: PropTypes.oneOf(['mouse', 'element', 'fixed']),
    tooltipContained: PropTypes.bool,
    tooltipOffset: PropTypes.objectOf(PropTypes.number),
    values: PropTypes.func,
    width: PropTypes.number.isRequired,
    xAxis: PropTypes.object,
    yAxis: PropTypes.object,
    x: PropTypes.func,
    y: PropTypes.func,
    y0: PropTypes.func
  };

  static defaultProps = {
    colorScale: d3.scale.category20(),
    data: {label: 'No data available', values: [{x: 'No data available', y: 1}]},
    interpolate: 'linear',
    label: stack => { return stack.label; },
    margin: {top: 0, bottom: 0, left: 0, right: 0},
    stroke: d3.scale.category20(),
    values: stack => { return stack.values; },
    x: e => { return e.x; },
    y: e => { return e.y; },
    y0: () => { return 0; }
  };

  constructor(props) {
    super(props);
    this.state = {
      tooltip: {
        hidden: true
      }
    };
  }

  componentDidMount() {
    this._svg_node = React.findDOMNode(this).getElementsByTagName('svg')[0];
  }

  componentWillMount() {
    helpers.calculateInner(this, this.props);
    helpers.arrayify(this, this.props);
    helpers.makeScales(this, this.props);
  }

  componentWillReceiveProps(nextProps) {
    helpers.calculateInner(this, nextProps);
    helpers.arrayify(this, nextProps);
    helpers.makeScales(this, nextProps);
  }

  handleMouseMove(e, data) {
    if (!this.props.tooltipHtml) {
      return;
    }

    e.preventDefault();

    const {
      margin,
      tooltipMode,
      tooltipOffset,
      tooltipContained
    } = this.props;

    const svg = this._svg_node;
    let position;
    if (svg.createSVGPoint) {
      let point = svg.createSVGPoint();
      point.x = e.clientX;
      point.y = e.clientY;
      point = point.matrixTransform(svg.getScreenCTM().inverse());
      position = [point.x - margin.left, point.y - margin.top];
    } else {
      const rect = svg.getBoundingClientRect();
      position = [e.clientX - rect.left - svg.clientLeft - margin.left,
      e.clientY - rect.top - svg.clientTop - margin.top];
    }

    const [html, xPos, yPos] = this._tooltipHtml(data, position);
    const svgTop = svg.getBoundingClientRect().top + margin.top;
    const svgLeft = svg.getBoundingClientRect().left + margin.left;

    let top = 0;
    let left = 0;

    if (tooltipMode === 'fixed') {
      top = svgTop + tooltipOffset.top;
      left = svgLeft + tooltipOffset.left;
    } else if (tooltipMode === 'element') {
      top = svgTop + yPos + tooltipOffset.top;
      left = svgLeft + xPos + tooltipOffset.left;
    } else { // mouse
      top = e.clientY + tooltipOffset.top;
      left = e.clientX + tooltipOffset.left;
    }

    function lerp(t, a, b) {
      return (1 - t) * a + t * b;
    }

    let translate = 50;

    if (tooltipContained) {
      const t = position[0] / svg.getBoundingClientRect().width;
      translate = lerp(t, 0, 100);
    }

    this.setState({
      tooltip: {
        top: top,
        left: left,
        hidden: false,
        html: html,
        translate: translate
      }
    });
  }

  handleMouseLeave(e) {
    if (!this.props.tooltipHtml) {
      return;
    }

    e.preventDefault();

    this.setState({
      tooltip: {
        hidden: true
      }
    });
  }

  _tooltipHtml(d, position) {
    const {x, y0, y, values } = this.props;
    const [xScale, yScale] = [this._xScale, this._yScale];

    const xValueCursor = xScale.invert(position[0]);

    const xBisector = d3.bisector(e => { return x(e); }).right;
    let xIndex = xBisector(values(d[0]), xScale.invert(position[0]));
    xIndex = (xIndex === values(d[0]).length) ? xIndex - 1: xIndex;

    const xIndexRight = xIndex === values(d[0]).length ? xIndex - 1: xIndex;
    const xValueRight = x(values(d[0])[xIndexRight]);

    const xIndexLeft = xIndex === 0 ? xIndex : xIndex - 1;
    const xValueLeft = x(values(d[0])[xIndexLeft]);

    if (Math.abs(xValueCursor - xValueRight) < Math.abs(xValueCursor - xValueLeft)) {
      xIndex = xIndexRight;
    } else {
      xIndex = xIndexLeft;
    }

    const yValueCursor = yScale.invert(position[1]);

    const yBisector = d3.bisector(e => { return y0(values(e)[xIndex]) + y(values(e)[xIndex]); }).left;
    let yIndex = yBisector(d, yValueCursor);
    yIndex = (yIndex === d.length) ? yIndex - 1: yIndex;

    const yValue = y(values(d[yIndex])[xIndex]);
    const yValueCumulative = y0(values(d[d.length - 1])[xIndex]) + y(values(d[d.length - 1])[xIndex]);

    const xValue = x(values(d[yIndex])[xIndex]);

    const xPos = xScale(xValue);
    const yPos = yScale(y0(values(d[yIndex])[xIndex]) + yValue);

    return [this.props.tooltipHtml(yValue, yValueCumulative, xValue), xPos, yPos];
  }

  render() {
    const {
      height,
      legend,
      width,
      margin,
      colorScale,
      interpolate,
      stroke,
      offset,
      values,
      label,
      x,
      y,
      y0,
      xAxis,
      yAxis
    } = this.props;

    const [
      data,
      innerWidth,
      innerHeight,
      xScale,
      yScale,
      xIntercept,
      yIntercept
    ] = [
      this._data,
      this._innerWidth,
      this._innerHeight,
      this._xScale,
      this._yScale,
      this._xIntercept,
      this._yIntercept
    ];

    const line = d3.svg.line()
      .x(function(e) { return xScale(x(e)); })
      .y(function(e) { return yScale(y0(e) + y(e)); })
      .interpolate(interpolate);

    const area = d3.svg.area()
      .x(function(e) { return xScale(x(e)); })
      .y0(function(e) { return yScale(yScale.domain()[0] + y0(e)); })
      .y1(function(e) { return yScale(y0(e) + y(e)); })
      .interpolate(interpolate);

    return (
      <div>
        <Chart className='chart' height={height} width={width} margin={margin} legend={legend}>
          <DataSet data={data} line={line} area={area} colorScale={colorScale} stroke={stroke} label={label} values={values} onMouseMove={this.handleMouseMove.bind(this)} onMouseLeave={this.handleMouseLeave.bind(this)} />
          <Axis className={"x axis"} orientation={"bottom"} scale={xScale} height={innerHeight} width={innerWidth} {...xAxis} />
          <Axis className={"y axis"} orientation={"left"} scale={yScale} height={innerHeight} width={innerWidth} {...yAxis} />
          { this.props.children }
        </Chart>
        <Tooltip {...this.state.tooltip}/>
      </div>
    );
  }

}

export default AreaChart;