using ScoreMap.Server.GameFeed;

namespace ScoreMap.Server.Tests.GameFeed;

public sealed class NascarCarBadgeTests
{
    [Theory]
    [InlineData("5", "https://cf.nascar.com/data/images/carbadges/1/5.png")]
    [InlineData(" 24 ", "https://cf.nascar.com/data/images/carbadges/1/24.png")]
    [InlineData("01", "https://cf.nascar.com/data/images/carbadges/1/01.png")]
    public void A_cars_number_has_its_cup_badge(string number, string url) => Assert.Equal(url, NascarCarBadge.Url(number));

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("1234")]
    [InlineData("5x")]
    [InlineData("../5")]
    public void Anything_but_a_car_number_has_none(string? number) => Assert.Null(NascarCarBadge.Url(number));
}
